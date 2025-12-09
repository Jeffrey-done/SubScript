import { Subscription, Budget, CATEGORIES, AIConfig } from '../types';
import { calculateStats } from '../utils';

const WS_URL = 'wss://maas-api.cn-huabei-1.xf-yun.com/v1.1/chat';

/**
 * Generate the HMAC-SHA256 signature and authorization URL
 */
async function getAuthUrl(config: AIConfig) {
    const host = "maas-api.cn-huabei-1.xf-yun.com";
    const date = new Date().toUTCString();
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const requestLine = "GET /v1.1/chat HTTP/1.1";
    
    const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
    
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
    
    return `${WS_URL}?authorization=${authorization}&date=${encodeURI(date)}&host=${host}`;
}

/**
 * Prepares the prompt based on user data
 */
function createPrompt(subscriptions: Subscription[], budget: Budget): string {
    const stats = calculateStats(subscriptions);
    const categories = Object.entries(stats.categoryBreakdown)
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

    return `Assuming you are a professional financial advisor. Please analyze my subscriptions and budget data to provide money-saving advice and financial health assessment.

    **My Financial Data:**
    - **Total Subscriptions:** ${subscriptions.length}
    - **Monthly Fixed Spending:** ${stats.monthlyTotal.toFixed(2)} CNY
    - **Yearly Fixed Spending:** ${stats.yearlyTotal.toFixed(2)} CNY
    - **Spending by Category:** ${categories}
    - **Income/Budget Info:**
      - Base Salary: ${budget.baseSalary} CNY
      - Commission: ${budget.commission} CNY
      - Target Monthly Budget for Subs: ${budget.monthly} CNY
    
    **Subscriptions List:**
    ${subsList}

    **Please Provide:**
    1. A brief assessment of my financial health regarding recurring expenses.
    2. Identify any potential areas where I am overspending.
    3. 3-5 concrete, actionable tips to optimize my subscription portfolio or save money.
    4. Use a professional yet encouraging tone.
    5. Please answer in Simplified Chinese (简体中文).
    `;
}

export const analyzeFinances = async (
    subscriptions: Subscription[],
    budget: Budget,
    config: AIConfig,
    onToken: (token: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
) => {
    try {
        if (!config.appId || !config.apiSecret || !config.apiKey) {
            throw new Error("请在设置中配置 AI API 凭证");
        }

        const url = await getAuthUrl(config);
        const socket = new WebSocket(url);

        socket.onopen = () => {
            const params = {
                header: {
                    app_id: config.appId,
                    uid: "user_default"
                },
                parameter: {
                    chat: {
                        domain: config.domain || "xdeepseekv3", // Default to xdeepseekv3 if not set
                        temperature: 0.5,
                        max_tokens: 4096 
                    }
                },
                payload: {
                    message: {
                        text: [
                            {
                                role: "user",
                                content: createPrompt(subscriptions, budget)
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
                    onToken(text);
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
            onError("Connection error occurred. Please check your network or API keys.");
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