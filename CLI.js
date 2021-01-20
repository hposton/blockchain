const P2P = require("./P2P.js");
const Blockchain = require("./Blockchain.js");
const blockchain = new Blockchain();
const p2p = new P2P(blockchain);
const Wallet = require("./Wallet.js");
const wallet = new Wallet(blockchain,p2p);
const Output = require("./Transaction.js").Output;


function cli(vorpal) {
	vorpal
		.use(welcome)
		.use(printBlockchain)
		.use(createTransactionOutput)
		.use(printTransactionOutputs)
		.use(createTransaction)
		.use(printTransactionPool)
		.use(mineBlock)
		.use(printTransaction)
		.use(getBalance)
		.use(importPublicKey)
		.use(startServer)
		.use(connectPeer)
		.delimiter('bc_wallet ->')
		.show();
}

module.exports = cli;

function welcome(vorpal) {
	vorpal.log("Welcome to Blockchain Wallet");
	vorpal.exec("help");
}

function printBlockchain(vorpal) {
	vorpal
		.command("blockchain","View the current blockchain")
		.alias("b")
		.action(function(args,callback) {
			this.log(blockchain)
			callback();
		}) 
}

function createTransactionOutput(vorpal) {
	vorpal
		.command("output <dst> <amount>","Define a transaction output")
		.alias("o")
		.action(function(args,callback) {
			wallet.addOutput(args.dst, args.amount);
			callback();
		})
}

function printTransactionOutputs(vorpal) {
	vorpal
		.command("show_outputs","Print current transaction outputs")
		.alias("so")
		.action(function(args,callback) {
			wallet.printUnusedOutputs();
			callback();
		})
}

function createTransaction(vorpal) {
	vorpal
		.command("transaction <fee> [outs...]","Create a transaction with a certain fee and predefined outputs")
		.alias("t")
		.action(function(args,callback) {
			if (args.fee && args.outs) {
				const outputs = wallet.selectOutputs(args.outs);
				const trans = wallet.buildTransaction(outputs,args.fee);
				if (trans == []) {
					this.log("Transaction creation failed");
				} else {
					p2p.sendTransaction(trans);
				}
			} else {
				this.log("Invalid request");
			}
			callback();
		})
}

function printTransactionPool(vorpal) {
	vorpal
		.command("transactionpool","Print the current contents of the transaction pool")
		.alias("tp")
		.action(function(args,callback) {
			const transactionPool = blockchain.transactionPool;
			for (let i = 0; i < transactionPool.length; i++) {
				let transaction = transactionPool[i];
				wallet.printTransaction(transaction);
			}
			callback();
		})
}
function printTransaction(vorpal) {
	vorpal
		.command("show_trans <block> <trans>","Print a particular transaction")
		.alias("st")
		.action(function(args,callback) {
			const transaction = blockchain.blockchain[args.block].transactions[args.trans];
			wallet.printTransaction(transaction);
			callback();
		})
}

function mineBlock(vorpal) {
	vorpal
		.command("mine","Create a new block")
		.alias("m")
		.action(function(args,callback) {
			const trans = blockchain.createRewardTransaction(wallet.addr);
			blockchain.transactionPool.unshift(trans);
			blockchain.createNextBlock();
			p2p.sendBlock(blockchain.latestBlock);
			callback();
		})
}

function getBalance(vorpal) {
	vorpal
		.command("balance","Get wallet ballance")
		.alias("wb")
		.action(function(args,callback) {
			const balance = wallet.getBalance();
			this.log("Balance: "+balance);
			callback();
		})
}

function importPublicKey(vorpal) {
	vorpal
		.command("import_key <keyfile>","Import public key from file")
		.alias("i")
		.action(function(args,callback) {
			if (args.keyfile) {
				wallet.importKey(args.keyfile);
			} else {
				this.log("Invalid import");
			}
			callback();
		})
}


function startServer(vorpal) {
	vorpal
		.command("start_server <port>","Start server")
		.alias("s")
		.action(function(args,callback) {
			if (args.port) {
				p2p.startServer(args.port);
			} else {
				this.log("Missing port number");
			}
			callback();
		})
}

function connectPeer(vorpal) {
	vorpal
		.command("connect <ip> <port>","Connect to peer")
		.alias("c")
		.action(function(args,callback) {
			if (args.ip && args.port) {
				p2p.connectToPeer(args.ip,args.port);
			} else {
				this.log("Missing IP or port");
			}
			callback();
		})
}
