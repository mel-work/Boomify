const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ContextMenuCommandBuilder,
    ApplicationCommandType
} = require('discord.js');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

// Environment check
console.log('🔧 Environment check:');
console.log('BOT_TOKEN exists:', !!process.env.BOT_TOKEN);
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('PORT:', process.env.PORT || 'Not set (will use 10000)');

if (!process.env.BOT_TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ Missing required environment variables: BOT_TOKEN, CLIENT_ID');
    process.exit(1);
}

// Initialize Anthropic (optional - fallback if not provided)
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
}) : null;

if (!anthropic) {
    console.warn('⚠️ ANTHROPIC_API_KEY not provided - will use simple fallback method');
}

// Bot status tracking
let botStatus = 'starting';
let botUser = null;
let lastError = null;
let startTime = new Date();

// Create Express app
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.static('public')); // In case you want to serve static files later

// Routes
app.get('/', (req, res) => {
    const uptime = Math.floor((new Date() - startTime) / 1000);
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Boomhauer Bot</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f4f4f4; }
                .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
                .online { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .offline { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .starting { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤠 Boomhauer Bot</h1>
                <div class="status ${botStatus === 'online' ? 'online' : botStatus === 'starting' ? 'starting' : 'offline'}">
                    Status: ${botStatus.toUpperCase()}
                </div>
                <p><strong>Bot:</strong> ${botUser ? botUser.tag : 'Not logged in'}</p>
                <p><strong>Uptime:</strong> ${uptime} seconds</p>
                <p><strong>Servers:</strong> ${botUser ? 'Loading...' : 'N/A'}</p>
                ${lastError ? `<p><strong>Last Error:</strong> ${lastError}</p>` : ''}
                <hr>
                <p>Man I tell ya what, this here bot takes your dang ol' messages and makes 'em sound like me, mmm-hmm.</p>
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    const health = {
        status: botStatus,
        bot: botUser ? botUser.tag : null,
        guilds: botUser ? client.guilds.cache.size : 0,
        uptime: Math.floor((new Date() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        error: lastError,
        hasAnthropicAPI: !!anthropic
    };
    
    res.status(botStatus === 'online' ? 200 : 503).json(health);
});

app.get('/ping', (req, res) => {
    res.json({ pong: true, timestamp: new Date().toISOString() });
});

// API endpoint for testing boomhauerify (optional)
app.post('/api/boomify', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        const result = await boomhauerify(text);
        res.json({ original: text, boomhauered: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the web server
const server = app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// Discord client setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

// Boomhauerify function with fallback
async function boomhauerify(text) {
    // Try Anthropic API if available
    if (anthropic) {
        try {
            const message = await anthropic.messages.create({
                model: "claude-3-haiku-20240307",
                max_tokens: 500,
                messages: [{
                    role: "user",
                    content: `Rewrite this exactly as Boomhauer from King of the Hill would say it. Use his characteristic speech patterns like "dang ol'", "talkin' 'bout", "man I tell ya what", and end with "mmm-hmm" or ", man". Keep the core meaning but make it sound like classic Boomhauer mumbling:

"${text}"`
                }]
            });
            
            return message.content[0].text.trim();
        } catch (error) {
            console.error('Anthropic API error:', error.message);
            // Fall through to simple method
        }
    }
    
    // Simple fallback method
    const fillers = [
        "man I tell ya what",
        "dang ol'",
        "talkin' 'bout",
        "man",
        "yo",
        "I tell you what",
        "know what I'm sayin'",
        "got-dang",
        "ol'",
        "tell you what man",
        "dang",
        "talkin' 'bout that",
        "you know",
        "I mean",
        "talkin' 'bout dang ol'",
        "know'm sayin'",
        "tell ya",
    ];

    const endings = [", man", "mmm-hmm"];

    const words = text.split(" ");
    let output = [];
    for (let word of words) {
        output.push(word);
        if (Math.random() < 0.25) {
            output.push(fillers[Math.floor(Math.random() * fillers.length)]);
        }
    }
    
    output.push(endings[Math.floor(Math.random() * endings.length)]);
    return output.join(" ");
}

// Discord event handlers
client.on('ready', () => {
    console.log(`✅ Discord bot logged in as ${client.user.tag}`);
    console.log(`🏠 Bot is in ${client.guilds.cache.size} servers`);
    botStatus = 'online';
    botUser = client.user;
});

client.on('error', error => {
    console.error('❌ Discord client error:', error);
    botStatus = 'error';
    lastError = error.message;
});

client.on('warn', warn => {
    console.warn('⚠️ Discord warning:', warn);
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Boomify') {
            await interaction.deferReply();
            
            const message = interaction.targetMessage;
            const originalText = message.content;

            if (!originalText || originalText.trim().length === 0) {
                return interaction.editReply({
                    content: "That message doesn't have any text to Boomify, mmm-hmm."
                });
            }

            if (originalText.length > 1000) {
                return interaction.editReply({
                    content: "Man I tell ya what, that dang ol' message too long for my brain, talkin' 'bout War and Peace or somethin', mmm-hmm."
                });
            }

            const boomed = await boomhauerify(originalText);
            const fullMessage = `${message.author} ${boomed}`;
            
            if (fullMessage.length > 2000) {
                return interaction.editReply({
                    content: "Man I tell ya what, that dang ol' message got too long after I worked my magic on it, mmm-hmm."
                });
            }

            return interaction.editReply({
                content: fullMessage,
                allowedMentions: { users: [message.author.id] }
            });
        }

        if (interaction.isUserContextMenuCommand() && interaction.commandName === 'Boomify Last Message') {
            await interaction.deferReply();
            
            const targetUser = interaction.targetUser;
            const messages = await interaction.channel.messages.fetch({ limit: 50 });
            const lastMessage = messages.find(m => m.author.id === targetUser.id && !m.author.bot);

            if (!lastMessage) {
                return interaction.editReply({
                    content: `${targetUser} hasn't said anything I can Boomify here, mmm-hmm.`
                });
            }

            if (lastMessage.content.length > 1000) {
                return interaction.editReply({
                    content: "Man I tell ya what, that dang ol' message too long for my brain, talkin' 'bout War and Peace or somethin', mmm-hmm."
                });
            }

            const boomed = await boomhauerify(lastMessage.content);
            const fullMessage = `${targetUser} ${boomed}`;
            
            if (fullMessage.length > 2000) {
                return interaction.editReply({
                    content: "Man I tell ya what, that dang ol' message got too long after I worked my magic on it, mmm-hmm."
                });
            }

            return interaction.editReply({
                content: fullMessage,
                allowedMentions: { users: [targetUser.id] }
            });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "Man I tell ya what, somethin' went wrong there, mmm-hmm.",
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: "Man I tell ya what, somethin' went wrong there, mmm-hmm."
                });
            }
        } catch (followupError) {
            console.error('Error sending error message:', followupError);
        }
    }
});

// Start Discord bot
async function startDiscordBot() {
    try {
        console.log('🤖 Starting Discord bot...');
        botStatus = 'logging_in';
        
        await client.login(process.env.BOT_TOKEN);
        console.log('🔐 Discord login initiated');
        
        // Register commands after login
        setTimeout(async () => {
            if (botStatus === 'online') {
                await registerCommands();
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Failed to start Discord bot:', error);
        botStatus = 'login_failed';
        lastError = `Login failed: ${error.message}`;
    }
}

// Command registration function
async function registerCommands() {
    try {
        console.log('📝 Registering Discord commands...');
        
        const commands = [
            new ContextMenuCommandBuilder()
                .setName('Boomify')
                .setType(ApplicationCommandType.Message)
                .setContexts([0, 1, 2]),

            new ContextMenuCommandBuilder()
                .setName('Boomify Last Message')
                .setType(ApplicationCommandType.User)
                .setContexts([0, 1, 2])
        ].map(command => command.toJSON());

        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Commands registered successfully!');
    } catch (error) {
        console.error('❌ Command registration failed:', error);
        lastError = `Command registration failed: ${error.message}`;
    }
}

// Start Discord bot after server is running
setTimeout(startDiscordBot, 3000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        client.destroy();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully...');
    server.close(() => {
        client.destroy();
        process.exit(0);
    });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    lastError = `Uncaught exception: ${error.message}`;
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    lastError = `Unhandled rejection: ${reason}`;
});