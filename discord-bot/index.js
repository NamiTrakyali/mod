require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('croxydb');
const axios = require('axios');

// Bot setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// Bot owner ID
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '510769103024291840';

// Helper functions
function hasPermission(member, permission) {
    return member.permissions.has(permission) || member.id === BOT_OWNER_ID;
}

function isOwner(userId) {
    return userId === BOT_OWNER_ID;
}

// Moderation data functions using croxydb
function addWarning(guildId, userId, reason, moderator) {
    const warnings = db.get(`warnings_${guildId}_${userId}`) || [];
    const warning = {
        id: Date.now().toString(),
        reason: reason,
        moderator: moderator,
        timestamp: Date.now()
    };
    warnings.push(warning);
    db.set(`warnings_${guildId}_${userId}`, warnings);
    return warnings.length;
}

function getWarnings(guildId, userId) {
    return db.get(`warnings_${guildId}_${userId}`) || [];
}

function removeWarning(guildId, userId, warningId) {
    const warnings = db.get(`warnings_${guildId}_${userId}`) || [];
    const filtered = warnings.filter(w => w.id !== warningId);
    db.set(`warnings_${guildId}_${userId}`, filtered);
    return filtered.length;
}

function addMute(guildId, userId, duration, reason, moderator) {
    const mute = {
        userId: userId,
        reason: reason,
        moderator: moderator,
        timestamp: Date.now(),
        duration: duration
    };
    db.set(`mute_${guildId}_${userId}`, mute);
}

function removeMute(guildId, userId) {
    db.delete(`mute_${guildId}_${userId}`);
}

function addBan(guildId, userId, reason, moderator) {
    const ban = {
        userId: userId,
        reason: reason,
        moderator: moderator,
        timestamp: Date.now()
    };
    db.set(`ban_${guildId}_${userId}`, ban);
}

function removeBan(guildId, userId) {
    db.delete(`ban_${guildId}_${userId}`);
}

// Chat GPT integration
async function getChatGPTResponse(message) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return "Yapay zeka şu anda çevrimdışı.";
    }
    
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'Sen Türkçe konuşan bir Discord bot yardımcısısın. Kısa ve öz cevaplar ver.'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: 150,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('ChatGPT API hatası:', error);
        return "Yapay zeka şu anda çevrimdışı.";
    }
}

// Slash commands
const commands = [
    // Moderation commands
    new SlashCommandBuilder()
        .setName('uyar')
        .setDescription('Bir kullanıcıyı uyarır')
        .addUserOption(option => option.setName('kullanici').setDescription('Uyarılacak kullanıcı').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Uyarı sebebi').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('uyarilar')
        .setDescription('Bir kullanıcının uyarılarını gösterir')
        .addUserOption(option => option.setName('kullanici').setDescription('Uyarıları gösterilecek kullanıcı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('uyari-sil')
        .setDescription('Bir uyarıyı siler')
        .addUserOption(option => option.setName('kullanici').setDescription('Uyarısı silinecek kullanıcı').setRequired(true))
        .addStringOption(option => option.setName('uyari-id').setDescription('Silinecek uyarı ID').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Bir kullanıcıyı sunucudan atar')
        .addUserOption(option => option.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Atılma sebebi').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('yasakla')
        .setDescription('Bir kullanıcıyı yasaklar')
        .addUserOption(option => option.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Yasaklama sebebi').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('yasak-kaldir')
        .setDescription('Bir kullanıcının yasağını kaldırır')
        .addStringOption(option => option.setName('kullanici-id').setDescription('Yasağı kaldırılacak kullanıcı ID').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('sustur')
        .setDescription('Bir kullanıcıyı susturur')
        .addUserOption(option => option.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
        .addIntegerOption(option => option.setName('sure').setDescription('Susturma süresi (dakika)').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Susturma sebebi').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('sustur-kaldir')
        .setDescription('Bir kullanıcının susturmasını kaldırır')
        .addUserOption(option => option.setName('kullanici').setDescription('Susturması kaldırılacak kullanıcı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('Belirtilen miktarda mesajı siler')
        .addIntegerOption(option => option.setName('miktar').setDescription('Silinecek mesaj miktarı').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('kullanici-bilgi')
        .setDescription('Bir kullanıcının bilgilerini gösterir')
        .addUserOption(option => option.setName('kullanici').setDescription('Bilgisi gösterilecek kullanıcı').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('sunucu-bilgi')
        .setDescription('Sunucu bilgilerini gösterir'),
    
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Bot gecikme süresini gösterir'),
    
    new SlashCommandBuilder()
        .setName('ai')
        .setDescription('AI ile sohbet et')
        .addStringOption(option => option.setName('mesaj').setDescription('AI\'ya gönderilecek mesaj').setRequired(true)),
];

// Register commands
client.once('ready', async () => {
    console.log(`${client.user.tag} aktif!`);
    
    try {
        console.log('Slash komutları yükleniyor...');
        await client.application.commands.set(commands);
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error('Slash komutları yüklenirken hata:', error);
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    const { commandName, guild, member, user } = interaction;
    
    try {
        switch (commandName) {
            case 'uyar':
                if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const targetUser = interaction.options.getUser('kullanici');
                const reason = interaction.options.getString('sebep');
                
                const warningCount = addWarning(guild.id, targetUser.id, reason, user.id);
                
                const warningEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Uyarı Verildi')
                    .addFields(
                        { name: 'Kullanıcı', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Moderatör', value: `<@${user.id}>`, inline: true },
                        { name: 'Sebep', value: reason, inline: false },
                        { name: 'Toplam Uyarı', value: warningCount.toString(), inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [warningEmbed] });
                break;
            
            case 'uyarilar':
                const targetForWarnings = interaction.options.getUser('kullanici');
                const warnings = getWarnings(guild.id, targetForWarnings.id);
                
                if (warnings.length === 0) {
                    return interaction.reply({ content: `<@${targetForWarnings.id}> kullanıcısının hiç uyarısı yok.`, ephemeral: true });
                }
                
                const warningsEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle(`${targetForWarnings.username} - Uyarılar`)
                    .setDescription(`Toplam ${warnings.length} uyarı`);
                
                warnings.forEach((warning, index) => {
                    warningsEmbed.addFields({
                        name: `Uyarı ${index + 1} (ID: ${warning.id})`,
                        value: `**Sebep:** ${warning.reason}\n**Moderatör:** <@${warning.moderator}>\n**Tarih:** <t:${Math.floor(warning.timestamp / 1000)}:f>`,
                        inline: false
                    });
                });
                
                await interaction.reply({ embeds: [warningsEmbed] });
                break;
            
            case 'uyari-sil':
                if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const targetForRemoval = interaction.options.getUser('kullanici');
                const warningId = interaction.options.getString('uyari-id');
                
                const remainingWarnings = removeWarning(guild.id, targetForRemoval.id, warningId);
                
                await interaction.reply({ content: `<@${targetForRemoval.id}> kullanıcısının uyarısı silindi. Kalan uyarı sayısı: ${remainingWarnings}` });
                break;
            
            case 'kick':
                if (!hasPermission(member, PermissionFlagsBits.KickMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const kickTarget = interaction.options.getMember('kullanici');
                const kickReason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
                
                if (kickTarget.id === user.id) {
                    return interaction.reply({ content: 'Kendinizi atamazsınız!', ephemeral: true });
                }
                
                if (kickTarget.roles.highest.position >= member.roles.highest.position && !isOwner(user.id)) {
                    return interaction.reply({ content: 'Bu kullanıcıyı atamazsınız!', ephemeral: true });
                }
                
                await kickTarget.kick(kickReason);
                await interaction.reply({ content: `<@${kickTarget.id}> kullanıcısı sunucudan atıldı.\n**Sebep:** ${kickReason}` });
                break;
            
            case 'yasakla':
                if (!hasPermission(member, PermissionFlagsBits.BanMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const banTarget = interaction.options.getMember('kullanici');
                const banReason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
                
                if (banTarget.id === user.id) {
                    return interaction.reply({ content: 'Kendinizi yasaklayamazsınız!', ephemeral: true });
                }
                
                if (banTarget.roles.highest.position >= member.roles.highest.position && !isOwner(user.id)) {
                    return interaction.reply({ content: 'Bu kullanıcıyı yasaklayamazsınız!', ephemeral: true });
                }
                
                addBan(guild.id, banTarget.id, banReason, user.id);
                await banTarget.ban({ reason: banReason });
                await interaction.reply({ content: `<@${banTarget.id}> kullanıcısı yasaklandı.\n**Sebep:** ${banReason}` });
                break;
            
            case 'yasak-kaldir':
                if (!hasPermission(member, PermissionFlagsBits.BanMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const unbanUserId = interaction.options.getString('kullanici-id');
                
                try {
                    await guild.members.unban(unbanUserId);
                    removeBan(guild.id, unbanUserId);
                    await interaction.reply({ content: `<@${unbanUserId}> kullanıcısının yasağı kaldırıldı.` });
                } catch (error) {
                    await interaction.reply({ content: 'Yasak kaldırılırken hata oluştu!', ephemeral: true });
                }
                break;
            
            case 'sustur':
                if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const muteTarget = interaction.options.getMember('kullanici');
                const muteDuration = interaction.options.getInteger('sure');
                const muteReason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
                
                if (muteTarget.id === user.id) {
                    return interaction.reply({ content: 'Kendinizi susturamassınız!', ephemeral: true });
                }
                
                if (muteTarget.roles.highest.position >= member.roles.highest.position && !isOwner(user.id)) {
                    return interaction.reply({ content: 'Bu kullanıcıyı susturamassınız!', ephemeral: true });
                }
                
                const muteTime = muteDuration * 60 * 1000; // Convert to milliseconds
                await muteTarget.timeout(muteTime, muteReason);
                addMute(guild.id, muteTarget.id, muteDuration, muteReason, user.id);
                
                await interaction.reply({ content: `<@${muteTarget.id}> kullanıcısı ${muteDuration} dakika susturuldu.\n**Sebep:** ${muteReason}` });
                break;
            
            case 'sustur-kaldir':
                if (!hasPermission(member, PermissionFlagsBits.ModerateMembers)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const unmuteTarget = interaction.options.getMember('kullanici');
                
                await unmuteTarget.timeout(null);
                removeMute(guild.id, unmuteTarget.id);
                
                await interaction.reply({ content: `<@${unmuteTarget.id}> kullanıcısının susturması kaldırıldı.` });
                break;
            
            case 'temizle':
                if (!hasPermission(member, PermissionFlagsBits.ManageMessages)) {
                    return interaction.reply({ content: 'Bu komutu kullanmak için yeterli yetkiniz yok!', ephemeral: true });
                }
                
                const deleteCount = interaction.options.getInteger('miktar');
                
                if (deleteCount < 1 || deleteCount > 100) {
                    return interaction.reply({ content: 'Silinecek mesaj miktarı 1-100 arasında olmalıdır!', ephemeral: true });
                }
                
                const deleted = await interaction.channel.bulkDelete(deleteCount, true);
                await interaction.reply({ content: `${deleted.size} mesaj silindi.`, ephemeral: true });
                break;
            
            case 'kullanici-bilgi':
                const infoTarget = interaction.options.getUser('kullanici') || user;
                const infoMember = await guild.members.fetch(infoTarget.id);
                
                const userInfoEmbed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('Kullanıcı Bilgileri')
                    .setThumbnail(infoTarget.displayAvatarURL())
                    .addFields(
                        { name: 'İsim', value: infoTarget.username, inline: true },
                        { name: 'Kimlik', value: infoTarget.id, inline: true },
                        { name: 'Sunucuya Katılma', value: `<t:${Math.floor(infoMember.joinedTimestamp / 1000)}:f>`, inline: true },
                        { name: 'Hesap Oluşturma', value: `<t:${Math.floor(infoTarget.createdTimestamp / 1000)}:f>`, inline: true },
                        { name: 'Uyarı Sayısı', value: getWarnings(guild.id, infoTarget.id).length.toString(), inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [userInfoEmbed] });
                break;
            
            case 'sunucu-bilgi':
                const serverInfoEmbed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle('Sunucu Bilgileri')
                    .setThumbnail(guild.iconURL())
                    .addFields(
                        { name: 'Sunucu İsmi', value: guild.name, inline: true },
                        { name: 'Üye Sayısı', value: guild.memberCount.toString(), inline: true },
                        { name: 'Oluşturulma Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:f>`, inline: true },
                        { name: 'Kanal Sayısı', value: guild.channels.cache.size.toString(), inline: true },
                        { name: 'Rol Sayısı', value: guild.roles.cache.size.toString(), inline: true },
                        { name: 'Sunucu Sahibi', value: `<@${guild.ownerId}>`, inline: true }
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [serverInfoEmbed] });
                break;
            
            case 'ping':
                const ping = client.ws.ping;
                await interaction.reply({ content: `🏓 Pong! Gecikme: ${ping}ms` });
                break;
            
            case 'ai':
                const aiMessage = interaction.options.getString('mesaj');
                
                // Check if AI is enabled for this channel
                const aiEnabled = db.get(`ai_${guild.id}_${interaction.channel.id}`) !== false;
                
                if (!aiEnabled) {
                    return interaction.reply({ content: 'Bu kanalda AI devre dışı!', ephemeral: true });
                }
                
                await interaction.deferReply();
                
                const aiResponse = await getChatGPTResponse(aiMessage);
                await interaction.editReply({ content: aiResponse });
                break;
        }
    } catch (error) {
        console.error('Komut hatası:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'Komut çalıştırılırken hata oluştu!', ephemeral: true });
        }
    }
});

// Handle messages for AI chat
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // Check if message mentions the bot
    if (message.mentions.has(client.user)) {
        const aiEnabled = db.get(`ai_${message.guild.id}_${message.channel.id}`) !== false;
        
        if (!aiEnabled) return;
        
        const content = message.content.replace(/<@!?\d+>/g, '').trim();
        if (!content) return;
        
        const response = await getChatGPTResponse(content);
        await message.reply(response);
    }
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);