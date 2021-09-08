module.exports = {
  name: 'showqueue',
  description: 'Show current queue!',
  execute(message) {
    const serverQueue = message.client.queue.get(message.guild.id);
    if (!serverQueue) return message.channel.send('There is no queue!');
    let text = ""
    for (let i = 0; i < serverQueue.songs.length; i++) {
      text += `${i + 1}.- ${serverQueue.songs[i].title}\n`
    }
    message.channel.send(text)
  },
};
