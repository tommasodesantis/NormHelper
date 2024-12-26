export const handler = async (event) => {
    try {
        // Parse request body
        const { question, history, conversationId } = JSON.parse(event.body);

        // Validate required environment variables
        const apiKey = process.env.DOCBOTS_API_KEY;
        const teamId = process.env.DOCBOTS_TEAM_ID;
        const botId = process.env.DOCBOTS_BOT_ID;

        if (!apiKey || !teamId || !botId) {
            throw new Error('Missing required environment variables');
        }

        // Call DocBots Chat Agent API
        const response = await fetch(
            `https://api.docsbot.ai/teams/${teamId}/bots/${botId}/chat-agent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    question,
                    conversationId,
                    stream: false,
                    metadata: null,
                    context_items: 16,
                    human_escalation: false,
                    followup_rating: false,
                    document_retriever: true,
                    full_source: false,
                    autocut: false
                })
            }
        );

        if (!response.ok) {
            throw new Error(`DocBots API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Find the lookup_answer event which contains our response
        const lookupAnswer = data.find(event => event.event === 'lookup_answer');
        if (!lookupAnswer) {
            throw new Error('No answer found in response');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                answer: lookupAnswer.data.answer,
                sources: lookupAnswer.data.sources,
                history: lookupAnswer.data.history
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal server error',
                error: error.message
            })
        };
    }
};
