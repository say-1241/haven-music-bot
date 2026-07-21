const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const http = require('http');

// خادوم وهمي لـ Render
http.createServer((req, res) => {
    res.write("Music Bot is Alive!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// تهيئة DisTube متوافقة مع v5
const distube = new DisTube(client, {
    emitNewSongOnly: true
});

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('تشغيل أغنية أو بحث من اليوتيوب')
        .addStringOption(opt => opt.setName('query').setDescription('اسم الأغنية أو الرابط').setRequired(true)),

    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('تخطي الأغنية الحالية'),

    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('إيقاف التشغيل والخروج من الروم الصوتي'),

    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('عرض قائمة التشغيل الحالية')
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`🎵 بوت الموسيقى جاهز: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🎉 تم تسجيل أوامر الموسيقى بنجاح!');
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: '❌ يجب أن تكون في روم صوتي أولاً!', ephemeral: true });
    }

    const { commandName } = interaction;

    if (commandName === 'play') {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        try {
            await distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member
            });
            return interaction.editReply(`🔎 جاري البحث وتشغيل: **${query}**`);
        } catch (error) {
            console.error(error);
            return interaction.editReply('❌ حدث خطأ أثناء محاولة تشغيل المقطع.');
        }
    }

    if (commandName === 'skip') {
        try {
            await distube.skip(interaction.guild);
            return interaction.reply('⏭️ تم تخطي الأغنية.');
        } catch (e) {
            return interaction.reply({ content: '❌ لا توجد أغنية تالية لتخطيها!', ephemeral: true });
        }
    }

    if (commandName === 'stop') {
        try {
            await distube.stop(interaction.guild);
            return interaction.reply('⏹️ تم إيقاف التشغيل والخروج من الروم.');
        } catch (e) {
            return interaction.reply({ content: '❌ لا يوجد شيء يشتغل حالياً!', ephemeral: true });
        }
    }

    if (commandName === 'queue') {
        const queue = distube.getQueue(interaction.guild);
        if (!queue) return interaction.reply({ content: '📂 قائمة التشغيل فارغة حالياً.', ephemeral: true });

        const qList = queue.songs
            .map((song, i) => `${i === 0 ? '▶️' : `${i}.`} ${song.name} - \`${song.formattedDuration}\``)
            .slice(0, 10)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🎶 قائمة التشغيل الحالية')
            .setDescription(qList)
            .setColor('#FF0055');

        return interaction.reply({ embeds: [embed] });
    }
});

distube.on('playSong', (queue, song) => {
    queue.textChannel.send(`🎶 يشتغل الآن: **${song.name}** - \`${song.formattedDuration}\``);
});

client.login(process.env.TOKEN);
