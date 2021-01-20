const wrtc = require("wrtc");
const net = require("net");
const Exchange = require("peer-exchange");
const ex = new Exchange("Sample Blockchain",{wrtc: wrtc});
class P2P {
	constructor(blockchain) {
		this.peers = [];
		this.blockchain = blockchain;
	}

	startServer(port) {
		const server = net.createServer(socket =>
			ex.accept(socket, (error,connection) => {
				if (error) {
					throw error;
				} else {
					this.setupConnection.call(this,connection);
				}
			})
		).listen(port);
	}

	findPeers() {
		ex.getNewPeer((error,connection) => {
			if (error) {
				throw error;
			} else {
				this.setupConnection.call(this,connection);
			}
		});
	}

	connectToPeer(host,port) {
		const socket = net.connect(port,host, () =>
			ex.connect(socket,(error,connection) => {
				if (error) {
					throw error;
				} else {
					this.setupConnection.call(this,connection);
				}
			})
		);
	}

	setupConnection(peer) {
		// Add new connection to list of peers
		this.peers.push(peer);
		// Set up data and error handling
		peer.on("data",data=> {
			const message = JSON.parse(data.toString("utf-8"));
			this.parseMessage(peer,message);
		});
		peer.on("error",error=> {throw error;});
		// Send newest peer latest block
		this.sendLatestBlock(peer);
	}

	send(peer,message) {
		peer.write(JSON.stringify(message));
	}

	parseMessage(peer,message) {
		let data = null;
		switch(message.code) {
			case 0: // Request latest block
				data = {
					code:1,
					data:this.blockchain.latestBlock
				}
				this.send(peer,data);
				break;
			case 1: // Receive latest block
				this.handleReceivedBlock(peer,message.data);
				break;
			case 2: // Request blockchain
				data = {
					code:3,
					data:this.blockchain.get()
				}
				this.send(peer,data);
				break;
			case 3: // Receive blockchain
				this.handleReceivedBlockchain(peer,message.data);
				break;
			case 4: // Receive transaction
				this.handleReceivedTransaction(peer,message.data);
				break;
			default:
				throw "Invalid message.";
		}
	}

	handleReceivedBlock(peer,received) {
		console.log("Received block");
		const latestBlock = this.blockchain.latestBlock;
		if (latestBlock.hash === received.previousHash) {
			this.blockchain.addExternalBlock(received);
		} else if (received.index > latestBlock.index) {
			console.log("Requesting full chain");
			let data = {code: 2};
			this.send(peer,data);
		} else {
			// Current blockchain is of equal length or longer
		}
	}

	handleReceivedBlockchain(peer,received) {
		try {
			console.log("Testing chain");
			let validation = this.blockchain.replaceChain(received);
			if (validation[0]) {
				let unsent = validation[1];
				for (let i = 0; i < unsent.length; i++) {
					this.sendTransaction(unsent[i]);
				}
			}
		} catch (error) {
			throw error;
		}
	}

	handleReceivedTransaction(peer,received) {
		try {
			if (this.blockchain.isValidTransaction(received)) {
				this.blockchain.insertTransaction(received);
			}
		} catch (error) {
			throw error;
		}
	}

	sendBlock(block) {
		let message = {
			code: 1,
			data: block
		};
		this.peers.forEach(
			peer => this.send(peer,message)
		);
	}

	sendTransaction(trans) {
		let message = {
			code:4,
			data:trans
		};
		this.peers.forEach(
			peer => this.send(peer,message)
		);
	}

	sendLatestBlock(peer) {
		let message = {
			code: 1,
			data: this.blockchain.latestBlock
		};
		this.send(peer,message);
	}
}

module.exports=P2P;
