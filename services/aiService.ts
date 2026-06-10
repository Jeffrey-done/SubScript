import { Subscription, Budget, CATEGORIES, AIConfig, AIModelConfig, Transaction, TRANSACTION_CATEGORIES, TransactionType } from '../types';
import { calculateStats } from '../utils';

const CHAT_WS_URL = 'wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/chat';
const IMAGE_API_URL = 'https://maas-api.cn-huabei-1.xf-yun.com/v2.1/tti';
const OCR_WS_URL = 'wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/vl'; // Vision-Language URL
const API_HOST = "maas-api.cn-huabei-1.xf-yun.com";

/**
 * Generate the HMAC-SHA256 signature and authorization URL
 * Supports both WebSocket (GET) and HTTP (POST) auth generation
 */
async function getAuthUrl(config: AIModelConfig, path: string, method: string = "GET"): Promise<string> {
    const date = new Date().toUTCString();
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const requestLine = `${method} ${path} HTTP/1.1`;
    
    // 1. Signature Calculation
    const signatureOrigin = `host: ${API_HOST}\ndate: ${date}\n${requestLine}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(config.apiSecret);
    const msgData = encoder.encode(signatureOrigin);
    
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    
    // Convert buffer to base64
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    const authorizationOrigin = `api_key="${config.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signatureBase64}"`;
    const authorization = btoa(authorizationOrigin);
    
    // 2. Query Params Construction
    // IMPORTANT: Use encodeURIComponent logic or replace + with %20 because 
    // standard URLSearchParams encodes spaces as '+', but some APIs require '%20'
    const params = new URLSearchParams();
    params.append("authorization", authorization);
    params.append("date", date);
    params.append("host", API_HOST);

    const queryString = params.toString().replace(/\+/g, '%20');

    // 3. Return Full URL
    if (path === "/v1.1/vl") {
        return `${OCR_WS_URL}?${queryString}`;
    } else if (method === "GET") {
         return `${CHAT_WS_URL}?${queryString}`;
    } else {
         return `${IMAGE_API_URL}?${queryString}`;
    }
}

/**
 * Generate an image based on a prompt
 */
export const generateImage = async (
    prompt: string,
    config: AIConfig
): Promise<string> => {
    try {
        const imageConfig = config.image;
        if (!imageConfig.appId || !imageConfig.apiSecret || !imageConfig.apiKey) {
            throw new Error("请先在设置中配置绘图 AI 密钥");
        }

        // 1. Check Proxy - STRICTLY REQUIRED for Web/Browser
        // iFlytek API does not support CORS, so we cannot call it directly from browser.
        if (!config.proxyUrl) {
             throw new Error("Web 端使用绘图功能必须配置代理 (Proxy URL)。请在设置中填写您的 Cloudflare Worker 地址。");
        }

        // 2. Get URL
        let url = await getAuthUrl(imageConfig, "/v2.1/tti", "POST");

        // 3. Apply Proxy
        // Reconstruct URL to point to Proxy but keep parameters
        const urlObj = new URL(url);
        // Replace the origin (https://maas-api...) with the proxy url
        const proxyBase = config.proxyUrl.replace(/\/$/, ''); // Remove trailing slash if user added it
        
        // We replace the origin of the signed URL with the proxy origin
        // e.g. https://maas-api.../v2.1/tti?... -> https://my-worker.../v2.1/tti?...
        url = url.replace(urlObj.origin, proxyBase);

        const body = {
            header: {
                app_id: imageConfig.appId,
                uid: "user_" + Date.now(),
                patch_id: ["0"] // Required by API: 0 for default/no-lora
            },
            parameter: {
                chat: {
                    domain: imageConfig.domain || "xopzimageturbo", 
                    width: 512,
                    height: 512,
                    seed: Math.floor(Math.random() * 100000),
                    num_inference_steps: 25,
                    guidance_scale: 7.5
                }
            },
            payload: {
                message: {
                    text: [{ role: "user", content: prompt }]
                }
            }
        };

        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                mode: 'cors', // Explicitly state we want CORS
                credentials: 'omit', // Important: don't send cookies/auth headers that might confuse proxy/api
                referrerPolicy: 'no-referrer'
            });
        } catch (networkError: any) {
            console.error("Network request failed", networkError);
            throw new Error(`无法连接到代理服务器 (${networkError.message})。请检查您的 Proxy URL 是否正确，以及 Cloudflare Worker 是否已部署。`);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.header.code !== 0) {
            // Throw specific API message (e.g., "Illegal access", "Invalid param")
            throw new Error(`${data.header.message} (Code: ${data.header.code})`);
        }

        const base64Content = data.payload?.choices?.text?.[0]?.content;
        if (!base64Content) {
            throw new Error("API 返回了空图片数据");
        }

        return `data:image/png;base64,${base64Content}`;

    } catch (e: any) {
        console.error("Image Gen Error", e);
        throw e;
    }
};

// --- Internal Helper: One-off DeepSeek Chat Request ---
async function askDeepSeek(textPrompt: string, config: AIModelConfig): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            const url = await getAuthUrl(config, "/v1.1/chat", "GET");
            const socket = new WebSocket(url);
            let fullText = "";

            socket.onopen = () => {
                const params = {
                    header: {
                        app_id: config.appId,
                        uid: "user_" + Math.random().toString(36).substring(7)
                    },
                    parameter: {
                        chat: {
                            domain: config.domain || "xdeepseekv3", // Use configured domain
                            temperature: 0.1, // Low temperature for extraction
                            max_tokens: 4096
                        }
                    },
                    payload: {
                        message: {
                            text: [{ role: "user", content: textPrompt }]
                        }
                    }
                };
                socket.send(JSON.stringify(params));
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.header.code !== 0) {
                    socket.close();
                    reject(new Error(`DeepSeek Error: ${data.header.message}`));
                    return;
                }
                if (data.payload?.choices?.text) {
                    fullText += data.payload.choices.text[0].content;
                }
                if (data.header.status === 2) {
                    socket.close();
                    resolve(fullText);
                }
            };

            socket.onerror = (err) => {
                reject(err);
            };
        } catch (e) {
            reject(e);
        }
    });
}

// --- Internal Helper: Perform Vision/OCR Request ---
async function performHunyuanOCR(imageBase64: string, config: AIModelConfig): Promise<string> {
    return new Promise(async (resolve, reject) => {
         try {
            const url = await getAuthUrl(config, "/v1.1/vl", "GET");
            const socket = new WebSocket(url);
            let fullResponse = "";

            socket.onopen = () => {
                const params = {
                    header: {
                        app_id: config.appId,
                        uid: "user_" + Math.random().toString(36).substring(7)
                    },
                    parameter: {
                        chat: {
                            domain: config.domain || "xophunyuanocr",
                            temperature: 0.5,
                            top_k: 4,
                            max_tokens: 2048
                        }
                    },
                    payload: {
                        message: {
                            text: [
                                {
                                    role: "user",
                                    content: JSON.stringify([
                                        {
                                            type: "image_url",
                                            image_url: {
                                                url: `data:image/jpeg;base64,${imageBase64}`
                                            }
                                        },
                                        {
                                            type: "text",
                                            // Stage 1: Just ask for raw text, no complex formatting
                                            text: "请尽可能详细地识别并提取图片中的所有文字内容，按行返回。"
                                        }
                                    ])
                                }
                            ]
                        }
                    }
                };
                socket.send(JSON.stringify(params));
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.header.code !== 0) {
                        socket.close();
                        reject(new Error(`OCR Error: ${data.header.message}`));
                        return;
                    }
                    if (data.payload?.choices?.text) {
                        fullResponse += data.payload.choices.text[0].content;
                    }
                    if (data.header.status === 2) {
                        socket.close();
                        resolve(fullResponse);
                    }
                } catch(e) { reject(e); }
            };

            socket.onerror = (e) => reject(e);

         } catch (e) { reject(e); }
    });
}

/**
 * Robust JSON extraction helper
 */
function extractAndParseJSON(text: string): any {
    try {
        // 1. Try direct parse
        return JSON.parse(text);
    } catch {
        // 2. Try removing markdown code blocks
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch {
            // 3. Regex extraction
            const match = clean.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
        }
    }
    throw new Error("无法解析返回的 JSON 数据");
}

/**
 * Parse transaction details from natural language text using DeepSeek
 * Enhanced to support mixed inputs (Natural Language OR OCR Text)
 */
export const parseTransactionFromText = async (
    text: string,
    config: AIConfig
): Promise<{ amount: number; date: string; category: string; description: string; type: TransactionType }> => {
    
    if (!config.chat?.apiKey) throw new Error("请先配置 Chat (DeepSeek) 密钥");

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Updated Prompt to handle both User Inputs and OCR Context safely
    // Specifically optimized for WeChat/Alipay Payment Screenshots
    const prompt = `
你是一个智能记账助手。请分析输入文本，提取记账关键信息并返回 JSON。
输入文本可能是用户的自然语言指令，也可能是 OCR 识别到的支付软件（微信/支付宝/银行APP）截图文字。

**输入文本:**
"""
${text}
"""

**提取规则 (请严格遵守):**
1. **amount (金额)**: 
   - 重点寻找画面中心的大号数字。
   - 优先提取紧跟在"金额"、"付款"、"提现"、"合计"、"¥"、"￥"之后的数字。
   - 忽略"余额"、"优惠"、"单价"等数字。
   - **特殊情况**: 如果是"零钱提现"或"提现详情"，金额通常是页面上最大的数字。
2. **date (日期)**: 
   - 提取具体交易时间，格式 YYYY-MM-DD。
   - 常见关键词："交易时间"、"支付时间"、"当前时间"、"提现时间"。
   - 如果未找到年份，默认使用今年 (${today.getFullYear()})。如果完全未找到，使用今天 (${todayStr})。
3. **description (描述)**: 
   - **商户支付**: 提取商户名称，通常位于截图最顶部居中，或者在"商户全称"、"交易对象"之后。示例："百乐佳便利超市"。
   - **提现/转账**: 如果标题是"零钱提现发起"、"提现详情"等，描述设为"零钱提现"或"转账"。
4. **type (类型)**: 
   - expense (支出): "付款"、"支付"、"消费"、"提现" (资产减少)。
   - income (收入): "退款"、"入账"、"收款"。
   - 默认为 expense。
5. **category (分类)**: 
   - 基于描述推断 (food, transport, shopping, housing, entertainment, medical, other)。
   - 提现/转账 -> other。
   - 超市/便利店 -> shopping 或 food。

**返回格式:**
纯 JSON 对象，无 Markdown。
示例: {"amount": 12.85, "date": "2025-12-09", "category": "other", "description": "零钱提现", "type": "expense"}
`;

    try {
        const aiResponse = await askDeepSeek(prompt, config.chat);
        console.log("AI Chat Parsed:", aiResponse);
        
        const parsed = extractAndParseJSON(aiResponse);

        return {
            amount: parseFloat(parsed.amount) || 0,
            date: parsed.date || todayStr,
            category: parsed.category || 'other',
            description: parsed.description || text.substring(0, 20).replace(/\n/g, ' '),
            type: (parsed.type === 'income' ? 'income' : 'expense') as TransactionType
        };
    } catch (e: any) {
        console.error("Smart Text Parse Failed", e);
        throw new Error("AI 解析失败: " + e.message);
    }
};

/**
 * Two-Stage Recognition Pipeline:
 * 1. Hunyuan OCR -> Get Raw Text
 * 2. DeepSeek V3 -> Extract Structured Data (JSON) via Unified Parser
 * 
 * Returns parsed object AND raw text for context.
 */
export const recognizeReceipt = async (
    imageBase64: string, // Pure base64 without prefix
    config: AIConfig
): Promise<{ amount: number; date: string; category: string; description: string; type: TransactionType; rawText: string }> => {
    
    // Check Configs
    if (!config.ocr?.apiKey) throw new Error("请先配置 OCR 密钥");
    if (!config.chat?.apiKey) throw new Error("请先配置 Chat (DeepSeek) 密钥");

    console.log("Step 1: Calling Hunyuan OCR...");
    let rawOcrText = "";
    try {
        rawOcrText = await performHunyuanOCR(imageBase64, config.ocr);
    } catch (e: any) {
        throw new Error("图片识别失败: " + e.message);
    }

    if (!rawOcrText || rawOcrText.length < 5) {
        throw new Error("未识别到有效文字");
    }

    // Default result structure
    const defaultResult = {
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category: 'other',
        description: '',
        type: 'expense' as TransactionType
    };

    let parsed = defaultResult;
    try {
        console.log("Step 2: Parsing OCR Text via DeepSeek...");
        // Use the unified parser for consistent logic
        parsed = await parseTransactionFromText(rawOcrText, config);
    } catch (e) {
        console.warn("DeepSeek parsing failed, falling back to manual correction", e);
        // We do NOT throw here. We return the raw text so the user can use the Chat UI to fix it.
    }

    return {
        ...parsed,
        rawText: rawOcrText
    };
};

/**
 * Prepares the prompt based on user data
 */
function createPrompt(subscriptions: Subscription[], budget: Budget, transactions: Transaction[]): string {
    const stats = calculateStats(subscriptions);
    const subCategories = Object.entries(stats.categoryBreakdown)
        .map(([name, val]) => {
             // @ts-ignore
             const label = CATEGORIES[name]?.label || name;
             // @ts-ignore
             return `${label}: ${val.value.toFixed(2)}`;
        })
        .join(', ');

    const subsList = subscriptions.map(s => 
        `- ${s.name} (${CATEGORIES[s.category]?.label}): ${s.price} ${s.currency}/${s.cycle}`
    ).join('\n');

    // Calculate Variable Expenses (last 30 days)
    const now = new Date();
    const last30Days = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
    
    const recentExpenses = transactions.filter(t => t.type === 'expense' && t.date >= last30Days);
    const totalRecentExpense = recentExpenses.reduce((sum, t) => sum + t.amount, 0);
    
    const expenseCategoryMap: Record<string, number> = {};
    recentExpenses.forEach(t => {
        if (!expenseCategoryMap[t.category]) expenseCategoryMap[t.category] = 0;
        expenseCategoryMap[t.category] += t.amount;
    });

    const expensesBreakdown = Object.entries(expenseCategoryMap)
        .map(([key, val]) => `${TRANSACTION_CATEGORIES[key]?.label || key}: ${val.toFixed(2)}`)
        .join(', ');

    return `Assuming you are a professional financial advisor. Please analyze my financial data (Subscriptions + Daily Expenses) to provide money-saving advice and financial health assessment.

    **My Financial Data:**
    
    **1. Fixed Subscriptions:**
    - **Total Active:** ${subscriptions.length}
    - **Monthly Fixed Spending:** ${stats.monthlyTotal.toFixed(2)} CNY
    - **Yearly Fixed Spending:** ${stats.yearlyTotal.toFixed(2)} CNY
    - **By Category:** ${subCategories}
    
    **2. Variable Expenses (Last 30 Days):**
    - **Total Spending:** ${totalRecentExpense.toFixed(2)} CNY
    - **Breakdown:** ${expensesBreakdown || 'None'}

    **3. Income/Budget Info:**
      - Base Salary: ${budget.baseSalary} CNY
      - Commission: ${budget.commission} CNY
      - Target Monthly Budget for Subs: ${budget.monthly} CNY
    
    **Subscriptions List:**
    ${subsList}

    **Please Provide:**
    1. A comprehensive assessment of my financial health (Fixed vs Variable spending).
    2. Identify specific areas where I am overspending (either in subs or daily habits).
    3. 3-5 concrete, actionable tips to save money.
    4. Use a professional yet encouraging tone.
    5. Please answer in Simplified Chinese (简体中文).
    `;
}

export const analyzeFinances = async (
    subscriptions: Subscription[],
    budget: Budget,
    transactions: Transaction[],
    config: AIConfig,
    onToken: (token: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
) => {
    try {
        const chatConfig = config.chat;
        if (!chatConfig.appId || !chatConfig.apiSecret || !chatConfig.apiKey) {
            throw new Error("请在设置中配置 AI 对话密钥");
        }

        const url = await getAuthUrl(chatConfig, "/v1.1/chat", "GET");
        
        const socket = new WebSocket(url);

        socket.onopen = () => {
            const params = {
                header: {
                    app_id: chatConfig.appId,
                    uid: "user_" + Math.random().toString(36).substring(7)
                },
                parameter: {
                    chat: {
                        domain: chatConfig.domain || "xdeepseekv3",
                        temperature: 0.5,
                        max_tokens: 4096 
                    }
                },
                payload: {
                    message: {
                        text: [
                            {
                                role: "user",
                                content: createPrompt(subscriptions, budget, transactions)
                            }
                        ]
                    }
                }
            };
            socket.send(JSON.stringify(params));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.header.code !== 0) {
                    console.error("API Error Response:", data);
                    onError(`API Error: ${data.header.code} - ${data.header.message}`);
                    socket.close();
                    return;
                }

                if (data.payload && data.payload.choices && data.payload.choices.text) {
                    const text = data.payload.choices.text[0].content;
                    if (text) {
                        onToken(text);
                    }
                }

                if (data.header.status === 2) {
                    onComplete();
                    socket.close();
                }
            } catch (e) {
                console.error("Parse error", e);
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error", error);
            onError("网络连接错误或 API 密钥无效，请检查设置。");
        };

        socket.onclose = () => {
            // Cleanup if needed
        };

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        };

    } catch (e: any) {
        onError(e.message || "Failed to initialize AI service");
        return () => {};
    }
};
