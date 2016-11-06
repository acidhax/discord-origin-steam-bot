// @flow
var async = require('async');
var mongoose = require('mongoose');
mongoose.connect('mongodb://acidhax:ahriman@ds055584.mlab.com:55584/matbee');
var ObjectId = (mongoose.Types.ObjectId);

var discordServer = new mongoose.Schema({ guild: 'string' });
var Server = mongoose.model('DiscordServer', discordServer);
var discordUser = new mongoose.Schema({ discordId: 'string', username: 'string', guild: [{type: mongoose.Schema.Types.ObjectId, ref: 'Server'}], originId: 'string', steamId: 'string' });
var User = mongoose.model('DiscordUser', discordUser);

const Discord = require('discord.js');
const bot = new Discord.Client();
const token= "MjQ0MjY2MTMxNzg5OTcxNDY2.Cv7CHg.kCBYstT8xGr9O-J6jvpSFULjU4o";

// the ready event is vital, it means that your bot will only start reacting to information
// from Discord _after_ ready is emitted.
bot.on('ready', () => {
  console.log('I am ready!');
  var channels = bot.channels.array();
  for (var channel in channels) {
    console.log(channels[channel].type)
  }
});
function getOrCreateServer(guild, cb) {
    Server.findOne({guild: guild}).then((server) => {
        if (!server) {
            server = new Server({ guild: guild});
            server.save(cb);
        } else {
            cb(null, server);
        }
    }).catch((err) => {
    })
}
function findGuildsForClientId(id, cb) {
    var outGuilds = [];
    bot.guilds.array().forEach((guild) => {
        guild.members.array().forEach((member) => {
            if (member.id == id) {
                outGuilds.push(guild);
            }
        });
    })
    return cb(null, outGuilds);
}
function getGuildByMongoId(id, cb) {
    console.log("getGuildByMongoId", id)
    Server.findById(id).then((server) => {
        getGuildByGuildId(server.guild, cb);
    }).catch((err) => {
        cb(err);
    })
}
function getGuildByGuildId(id, cb) {
    var list = bot.guilds.array();
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return cb(null, list[i]);
        }
    }
}

function getChannelMembersByChannelNameForGuild(name, guild, cb) {
    var arr = guild.channels.array();
    var members = [];
    arr.forEach((channel) => {
        if (name.toLowerCase() == channel.name.toLowerCase()) {
            members = members.concat(channel.members.array())
        }
    });
    cb(null, members)
}

function getChannelsByChannelNameForGuilds(name, guilds, cb) {
    var out = [];
    var strippedName = name.replace(/ /g,'');
    strippedName = strippedName.replace(/\-/g, '');
    strippedName = strippedName.toLowerCase();
    guilds.forEach(guild => {
        getGuildByGuildId(guild.guild, (err, guild) => {
            var list = guild.channels.array();
            for (var i = 0; i < list.length; i++) {
                var strippedGuildName = list[i].name;
                strippedGuildName = strippedGuildName.replace(/ /g,'');
                strippedGuildName = strippedGuildName.replace(/\-/g, '');
                strippedGuildName = strippedGuildName.toLowerCase();
                if (strippedGuildName.indexOf(strippedName) > -1) {
                    out.push(list[i]);
                }
            }
        })
    })
    cb(null, out);
};
function stripName (str) {
    var strippedName = str.replace(/ /g,'');
    strippedName = strippedName.replace(/\-/g, '');
    strippedName = strippedName.toLowerCase();
    return strippedName;
}
bot.on('voiceJoin', (voiceChannel, discordUser) => {
    console.info(discordUser.username, " Joined voice channel: ", voiceChannel.name)
});
// create an event listener for messages
bot.on('message', message => {
    var activeGuild = null;
    var activeChannel = null;
    if (message.author.id != bot.user.id) {
        if (message.content.substring(0,1) != "!") return;
        console.info("on Message:", message);
        if (message.channel.type == "text") {
            // In text channel.
            activeGuild = message.channel.guild;
            activeChannel = message.channel;
        }
        findGuildsForClientId(message.author.id, (err, guilds) => {
            async.forEachOf(guilds, (guild, index, next) => {
                getOrCreateServer(guild.id, (err, newGuild) => {
                    if (guild == activeGuild) {
                        activeGuild.mongoGuild = newGuild;
                    }
                    guilds[index]=newGuild;
                    guilds[index].discordGuild = guild;
                    next(err);
                });
            }, (err) => {
                async.parallel([
                    (done) => {
                        User.findOne({discordId: message.author.id}).then((user) => {
                            if (!user) {
                                user = new User({
                                    discordId: message.author.id,
                                    username: message.author.username,
                                    guild: guilds
                                });

                                user.save().then((user)=>{
                                    done(null, user);
                                }).catch((err) => {
                                    done(err);
                                });
                                
                            } else {
                                done(null, user);
                            }
                        }).catch((err) => {
                            done(err);
                        });
                    }
                ], (err, results) => {
                    var firstFlagIndex = message.content.trim().indexOf(" ");
                    if (firstFlagIndex == -1) {
                        firstFlagIndex = message.content.length;
                    }
                    var flag = message.content.trim().substring(0, firstFlagIndex).toLowerCase();
                    var userMsg = message.content.substring(firstFlagIndex).trim();
                    var user = results[0];
                    if (!err) {
                        if (flag == "!invite" && (!user.steamId && !user.originId)) {
                            message.author.sendMessage("To become part of the community, please add your Steam and/or Origin information, and then request the list of players!")
                             .then(message => console.log(`Sent message: ${message.content}`))
                             .catch(console.error);
                            message.author.sendMessage("Example: !Steam " + message.author.username)
                             .then(message => console.log(`Sent message: ${message.content}`))
                             .catch(console.error);
                            message.author.sendMessage("Example: !Origin " + message.author.username)
                             .then(message => console.log(`Sent message: ${message.content}`))
                             .catch(console.error);
                        } else if (flag == "!invite") {
                            if (userMsg == "" && !activeChannel) {
                                message.author.sendMessage("Please specify a Channel name, for example: !invite " + guilds[0].discordGuild.channels.array()[0].name)
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                            } else {
                                if (!activeChannel || userMsg != "") {
                                    getChannelsByChannelNameForGuilds(userMsg, guilds, foundChannel);
                                } else {
                                    foundChannel(null, [activeChannel]);
                                }
                                function foundChannel(err, channels) {
                                    var spammedUsers = {};
                                    channels.forEach((channel) => {
                                        var users = channel.members.array();
                                        async.forEach(users, (discordUser, next) => {
                                            if (discordUser.user.id != message.author.id && !spammedUsers[discordUser.user.id] && (discordUser.presence.status === 'online' || discordUser.presence.status === 'idle')) {
                                                spammedUsers[discordUser.user.id] = true;
                                                User.findOne({discordId:discordUser.user.id}).then((user) => {
                                                    if (user) {
                                                        if (user.originId || user.steamId) {
                                                            message.author.sendMessage(discordUser.user.username + ", " + (user.originId ? ("Origin: `" + user.originId + "`") : "") + (user.steamId ? (" Steam: `" + user.steamId + "`") : ""))
                                                             .then(message => console.log(`Sent message: ${message.content}`))
                                                             .catch(console.error);
                                                        } else {
                                                        }
                                                        next(null, user);
                                                    } else {
                                                        next(null);
                                                    }
                                                }).catch(err => {
                                                    console.info("ERRORR!!!!!!", err);
                                                    next(err);
                                                })
                                            } else {
                                                next(null);
                                            }
                                        }, (err) => {
                                            if (err) {
                                            }
                                            message.author.sendMessage("`Add these users Steam/Origin account to your friends list. Be sure to hop onto the Voice Channel and tell everyone to accept your friend requests!`")
                                             .then(message => console.log(`Sent message: ${message.content}`))
                                             .catch(console.error);
                                        })
                                    })
                                }
                            }
                        } else if (flag == "!steam" && userMsg.length > 0) {
                            user.steamId = userMsg;
                            user.save().then((user)=>{
                                message.author.sendMessage("Your Steam username has been set to " + userMsg)
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                                message.author.sendMessage("Try the `!invite` command and add the users Steam/Origin account to your friends list. Be sure to hop onto the Voice Channel and tell everyone to accept your friend requests!")
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                                message.author.sendMessage("Welcome to the community, now please join our Steam group at http://steamcommunity.com/groups/ArcadeMafiaPachi")
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                            }).catch((err) => {
                                console.error("ERRR USER!", err);
                            });
                        } else if (flag == "!origin" && userMsg.length > 0) {
                            user.originId = userMsg;

                            user.save().then((user)=>{
                                message.author.sendMessage("Your Origin username has been set to " + userMsg)
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                                message.author.sendMessage("Try the `!invite` command and add the users Steam/Origin account to your friends list. Be sure to hop onto the Voice Channel and tell everyone to accept your friend requests!")
                                 .then(message => console.log(`Sent message: ${message.content}`))
                                 .catch(console.error);
                            }).catch((err) => {
                                console.error("ERRR USER!", err);
                            });
                        }
                    }
                })
            })
        });
    }
});

// log our bot in
bot.login(token);