var rtu = require('./rtu.js');
var git = require('./git.js');
var ideFS = require('./ideFS.js');
var fs = require('fs');
var execFileSync = require('child_process').execFileSync;
var spawn = require('child_process').spawn;
var WebSocketServer = require('ws').Server;

function explorerCreator(files,proj, curpath)
{//finished i think working as intended
	var newproj = [];
	for(var dir in proj){
		files.push(ideFS.getProjectFiles(curpath+proj[dir]));
		var count = 0;
		for(var f in files[files.length-1])
		{
			if(fs.lstatSync('workspace/'+curpath+proj[dir]+'/'+files[files.length-1][f]).isDirectory())
			{
				newproj.push(files[files.length-1][f]);
				//point to array with folder in it
				files[files.length-1][f]+='/'+((+files.length+ +count));
				count++;
				//return explorerCreator(files,fs.readdirSync(curpath), curpath);//needs a string that holds current path
			}//if directory

		}//finds all directories within directory
		if(newproj.length != 0){
			explorerCreator(files,newproj,curpath+proj[dir]+'/');
			newproj = [];
		}
		else {
			return;
		}
	}//completed array
}
function broadcastResponse(connectionList, responseString)
{
	connectionList.forEach(function(conn)
	{
		conn.connection.send(responseString);
	});
}

function runServer(portNumber)
{
	console.log("Running the IDE server on port " + portNumber + "...");
	var server = new WebSocketServer({port: portNumber});
	var connectionList = [];
	var connind = -1;
	server.on('connection', function connection(ws)
	{
		console.log('New connection attempted!');
		ws.on('message', function incoming(message)
		{
			console.log('received: %s', message);
			var response = {"type": "", "contents": null};
			try
			{
				var json_message = JSON.parse(message);
				var nickname = json_message.nickname;
				var contents = json_message.contents;
				var file = json_message.file;
				var dir = json_message.dir;
				var change = json_message.change;
				var command = contents.split(' ')[0].toLowerCase();
				var spaceIndex = contents.indexOf(' ');
				var params = contents.substring(spaceIndex + 1);

				var found = false;
				connectionList.forEach(function(conn)
				{
					if(conn.connection == ws)
					{
						found = true;
						connind = connectionList.indexOf(conn);
					}
				});

				if(found || command == "connect")
				{
					switch(command)
					{
						case "connect":
							response.type = "Connection-Accept";
							if(connectionList.length + 1 > ideFS.getConfigObj().max_clients)
							{
								response.contents = {"Accepted": false, "Reason": "The server you tried to connect to is full."};
								console.log("Rejected incoming connection because the server is full.");
							}
							if(response.contents == null)
							{
								connectionList.forEach(function(conn)
								{
									if(conn.nickname == nickname)
									{
										response.contents = {"Accepted": false, "Reason": "The nickname you selected is already in use on this server. Please enter a unique nickname and try again."};
										console.log("Rejected incoming connection for taken nickname.");
									}
								});
							}
							if(response.contents == null)
							{
								var proj = fs.readdirSync("workspace/");
								var curpath = '';
								var files;
								explorerCreator(files= [],proj, curpath);
								/*var files = [];
								for(var dir in proj){
									files[dir] = (ideFS.getProjectFiles(proj[dir]));

								}*/
								for(var dir in files)
									console.log(files[dir]);
								connectionList.push({"connection":ws,"nickname":nickname,"user":null,"pass":null,"valid":false});
								response.contents = {"Accepted": true, "Proj":proj, "Files": files};
								console.log("Accepted incoming connection from user '"+ nickname  +"'.");
							}
							ws.send(JSON.stringify(response));
							break;
						case "setusername":
							connectionList[connind].user = params;
							break;
						case "setpassword":
							connectionList[connind].pass = params;
							break;
						case "testcredentials":
							response.type = "Valid-Credentials-Status";
							var user, pass;
							var valid = false;
							user = connectionList[connind].user;
							pass = connectionList[connind].pass;
							valid = git.testlogin(user, pass);
							connectionList[connectionList.indexOf(conn)].valid = valid;
							response.contents = {"Valid": valid};
							break;
						case "compile":
							response.type = "Compile-Running-Status";
							console.log("Received command to compile!");
							response.contents = {"output": compile(dir)};
							ws.send(JSON.stringify(response));
							break;
						case "run":
							response.type = "Code-Running-Status";
							console.log("Running code...");
							var str = run(file, "some args", dir);
							console.log(str);
							response.contents = {"output": str};
							ws.send(JSON.stringify(response));
							break;
						case "message":
							response.type = "Message-Broadcast";
							response.contents = nickname + ": " + params;
							console.log("Received chat message from user '" + nickname + "': " + params);
							broadcastResponse(connectionList, JSON.stringify(response));
							break;
						case "newproject":
							response.type = "Project-Created-Status";
							if(!ideFS.createProject("workspace/" + params))
							{
								response.contents = {"Created": false, "Reason": "Failed to create a new project with the name '" + params + "'! That project name is already taken."};
							}
							else
							{
								response.contents = {"Created": true};
							}
							ws.send(JSON.stringify(response));
							break;
						case "newfile":
							response.type = "File-Created-Status";
							if(!ideFS.createFile(params, dir))
							{
								response.contents = {"Created": false, "Reason": "Failed to create a new file with the name '" + params + "'! That file already exists in the current project."};
							}
							else
							{
								response.contents = {"Created": true};
								var startContents = "public class " + params.replace(".java", "") + "\n{\n\tpublic static void main(String[] args)\n\t{\n\t\t// Edit this class as you please\n\t\tSystem.out.println(\"Hello World!\");\n\t}\n}"
								rtu.newfile(dir + "/" + params, startContents);
							}
							ws.send(JSON.stringify(response));
							break;
						case "deletefile":
							response.type = "File-Deleted-Status";
							if(!ideFS.deleteFile(params))
							{
								response.contents = {"Deleted": false, "Reason": "Failed to remove file '" + params + "'"};
							}
							else
							{
								var split = params.split('/');
								console.log(split[0]);
								console.log(split[1]);
								response.contents = {"Deleted": true, "proj": split[0], "file": split[1]};
							}
							ws.send(JSON.stringify(response));
							break;
						case "newdir":
							response.type = "Directory-Created-Status";
							if(!ideFS.createFile(params, dir))
							{
								response.contents = {"Created": false, "Reason": "Failed to create a new directory with the name '" + params + "'! That file already exists in the current project."};
							}
							else
							{
								response.contents = {"Created": true};
							}
							ws.send(JSON.stringify(response));
							break;
						case "openfile":
							response.type = "File-Open-Response";
							var files = ideFS.getProjectFiles(dir);
							if(files != null)
							{
								response.contents = {"Opened": true, "Dir": dir, "Files": files};
							}
							else
							{
								response.contents = {"Opened": false};
							}
							ws.send(JSON.stringify(response));
							break;
						case "gotupdate":
							incqstate(dir + "/" + file, nickname); // this guy is up to date
							break;
						case "rtu":
							response.type = "RTU-Got-Message";
							ws.send(JSON.stringify(response)); // ack

							var fpath = dir + "/" + file;
							change = rtu.adjustchange(fpath, nickname, change); // adjust
							rtu.enQ(fpath, change); // log
							rtu.bufwrite(fpath, change); // update buffer

							var bc =
							{
								"type": "RTU-Broadcast",
								"nickname": nickname,
								"dir": dir,
								"file": file,
								"contents": change
							};
							broadcastResponse(connectionList, JSON.stringify(bc)); // send out
							break;
						case "readfile":
							response.type = "Read-File";
							var str = fs.readFileSync("workspace/" + dir + "/" + params, "utf8").toString();
							response.contents = {"body": str, "proj": dir, "file": params};
							ws.send(JSON.stringify(response));
							rtu.readfile(nickname, dir + "/" + params, str);
							break;
						case "git":
							git.runGit(params, dir);
							break;
						case "git_newproject":
							if (connectionList[connind].valid)
							{
								git.createproj(connectionList[connind].user, connectionList[connind].pass, "workspace/" + dir);
							}
							break;
						case "git_clone":
							git.clone(params);
							break;
						case "git_pull":
							git.pull(params, dir);
							break;
						case "git_add":
							git.add(params, dir);
							break;
						case "git_commit":
							git.commit(params, dir);
							break;
						case "git_push":
							git.push(dir);
							break;
						default:
							response.type = "Error";
							response.contents = "Unrecognized command '" + command  + "'!";
							break;
					}
				}
				else
				{
					console.log("The user that issued the given command was unrecognized!");
				}
			}
			catch(err)
			{
				response.type = "Error";
				response.contents = "The message received did not match the proper protocol!\n Message: " + message + "\nExact error: " + err;
				console.log(err);
			}
		});
		ws.on('close', function()
		{
			var found = false;
			connectionList.forEach(function(conn)
			{
				if(conn.connection == ws)
				{
					found = true;
					console.log("User '" + conn.nickname  + "' has disconnected!");
					connectionList.splice(connectionList.indexOf(conn), 1);
				}
			});
			if(!found)
			{
				console.log("An unknown client disconnected!");
			}
		});
	});
}

if(!ideFS.configExists())
{
	ideFS.createConfig();
}

ideFS.readConfig();

runServer(ideFS.getConfigObj().port);
