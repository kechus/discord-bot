const ytdl = require("ytdl-core");
const search = require('youtube-search');
var SpotifyWebApi = require('spotify-web-api-node');

var spotifyApi = new SpotifyWebApi({
  clientId: '819f507ad2dd41848f7125920d9b1a0e',
  clientSecret: process.env.SPOTIFY_KEY,
  redirectUri: 'https://mamarracho-bot.herokuapp.com/'
});

spotifyApi.clientCredentialsGrant().then(
  function (data) {
    console.log('The access token is ' + data.body['access_token']);
    spotifyApi.setAccessToken(data.body['access_token']);
  });

const opts = {
  maxResults: 1,
  key: process.env.GOOGLE_KEY,
  type: ["video"]
};

module.exports = {
  name: "play",
  description: "Play a song in your channel!",
  async execute(message) {
    try {
      let [command, ...args] = message.content.split(' ');
      args = args.join(' ')
      const queue = message.client.queue;
      const serverQueue = message.client.queue.get(message.guild.id);

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel)
        return message.channel.send(
          "You need to be in a voice channel to play music!"
        );
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
          "I need the permissions to join and speak in your voice channel!"
        );
      }

      let links = [];
      if (args.includes('https://open.spotify.com/')) {
        links = await this.getLinksFromSpotify(args)
      }
      else if (!args.includes("https://")) {
        const link = await this.ytSearch(args)
        links.push(link)
      } else {
        links.push(args)
      }

      const songs = []
      for (const link of links) {
        const songInfo = await ytdl.getInfo(link);
        const song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url
        };
        songs.push(song)
      }

      if (!serverQueue) {
        const queueContruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true
        };

        queue.set(message.guild.id, queueContruct);

        for (const song of songs) {
          queueContruct.songs.push(song);
        }

        try {
          var connection = await voiceChannel.join();
          queueContruct.connection = connection;
          this.play(message, queueContruct.songs[0]);
        } catch (err) {
          console.log(err);
          queue.delete(message.guild.id);
          return message.channel.send(err);
        }
      } else {
        for (const song of songs) {
          serverQueue.songs.push(song);
        }
        const msg = songs.length > 1 ? "Album" : songs[0].title
        return message.channel.send(
          `${msg} has been added to the queue!`
        );
      }
    } catch (error) {
      console.log(error);
      message.channel.send(error.message);
    }
  },

  async ytSearch(searchQuery) {
    return new Promise(async (resolve, reject) => {
      const searchResults = await search(searchQuery, opts)
      resolve(searchResults.results[0].link)
    })
  },

  async spotifySearch(id) {
    return new Promise(async (resolve, reject) => {
      const data = await spotifyApi.getTrack(id)
      const searchQuery = `${data.body.name} ${data.body.artists[0].name}`
      const url = await this.ytSearch(searchQuery, opts)
      resolve(url)
    })
  },

  async getLinksFromSpotify(args) {
    return new Promise(async (resolve, reject) => {
      const links = []
      const queryString = args.split('/')
      const id = queryString[queryString.length - 1].split('?')[0]

      if (queryString[3] == "track") {
        args = await this.spotifySearch(id)
        links.push(args)
      } else if (queryString[3] == "album") {
        const tracks = await spotifyApi.getAlbumTracks(id, { limit: 20 })

        for (const track of tracks.body.items) {
          const searchQuery = `${track.name} ${track.artists[0].name}`
          const link = await this.ytSearch(searchQuery)
          links.push(link)
        };
      }

      resolve(links)
    })
  },

  play(message, song) {
    const queue = message.client.queue;
    const guild = message.guild;
    const serverQueue = queue.get(message.guild.id);

    if (!song) {
      queue.delete(guild.id);
      return;
    }

    const dispatcher = serverQueue.connection
      .play(ytdl(song.url))
      .on("finish", () => {
        serverQueue.songs.shift();
        this.play(message, serverQueue.songs[0]);
      })
      .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
  }
};
