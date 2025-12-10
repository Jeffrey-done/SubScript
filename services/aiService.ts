import { Subscription, Budget, CATEGORIES, AIConfig, AIModelConfig, Transaction, TRANSACTION_CATEGORIES } from '../types';
import { calculateStats } from '../utils';

const CHAT_WS_URL = 'wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/chat';
const IMAGE_API_URL = 'https://maas-api.cn-huabei-1.xf-yun.com/v2.1/tti';
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
    if (method === "GET") {
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

                // Status 2 means generation complete
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