const crypto = require("crypto");
const fs = require("fs")
const Output = require("./Transaction.js").Output;
const Transaction = require("./Transaction.js").Transaction;

class Wallet {
	constructor(blockchain,network) {
		this.blockchain = blockchain;
		this.network = network;
		this.outputs = [];
		this.privateKey = this.getPrivateKey();
		this.publicKey = this.getPublicKey(this.privateKey);
		this.addr = this.genAddr(this.publicKey);
		this.blockchain.publicKeys.set(this.addr,this.publicKey);
	}
	
	// Key Management
	getPrivateKey() {
		return fs.readFileSync("keys/privateKey.pem","utf-8");
	}
	getPublicKey() {
		return fs.readFileSync("keys/publicKey.pem","utf-8");
	}
	importKey(keyfile) {
		let publicKey = fs.readFileSync(keyfile,"utf-8");
		let addr = this.genAddr(publicKey);
		this.blockchain.publicKeys.set(addr,publicKey);
	}
	genSignature(data) {
		const signer = crypto.createSign("RSA-SHA256");
		signer.write(data);
		signer.end();
		return signer.sign(this.privateKey,"hex");
	}
	genAddr(publicKey) {
		const addr = crypto
				.createHash("sha256")
				.update(publicKey)
				.digest("hex")
		return addr
	}

	addOutput(dst,amt) {
		const output = new Output(dst,amt,null);
		this.outputs.push(output);
	}
	selectOutputs(indices) {
		let outputs = []
		for (let i = 0; i < indices.length; i++) {
			outputs.push(this.outputs[parseInt(indices[i])]);
		}
		return outputs;
	}
	printUnusedOutputs() {
		for (let i = 0; i < this.outputs.length; i++) {
			console.log("Output "+i+" Dest: "+this.outputs[i].address + " Value: "+this.outputs[i].value);
		}
	}
	signInput(input) {
		let data = [input.address,input.value].toString();
		return this.genSignature(data);
	}

























	buildTransaction(outputs,fee) {
		const outValue = this.calcTotalValue(outputs) + fee;
		const possInputs = this.findInputs();
		const inValue = this.calcTotalValue(possInputs);
		if (outValue > inValue) {
			return [];
		}
		let value = inValue;
		let i = 0;
		while(value - possInputs[i].value >= outValue) {
			value -= possInputs[i].value;
			i++;
		}
		let inputs = possInputs.slice(i);
		if (value != outValue) {
			let o = new Output(this.addr,value-outValue,null);
			outputs.push(o);
		}
		for (let j = 0; j < inputs.length; j++) {
			inputs[j].signature = this.signInput(inputs[j]);
		}
		const trans = this.blockchain.buildTransaction(inputs,outputs,fee);
		if (trans == false) {
			return [];
		}
		this.addTransaction(trans);
		return trans;
	}

	findInputs() {
		let addr = this.addr;
		let availableInputs = [];
		for (let i = 0; i < this.blockchain.unusedOutputs.length; i++) {
			let output = this.blockchain.unusedOutputs[i];
			if (output.address == addr) {
				availableInputs.push(output);
			}
		}
		return availableInputs;
	}

	calcTotalValue(outputs) {
		let value = 0;
		for (let i = 0; i < outputs.length; i++) {
			value += outputs[i].value;
		}
		return value;
	}


	addTransaction(trans) {
		this.blockchain.insertTransaction(trans);
		this.network.sendTransaction(trans);
	}















 	printOutputs(outputs) {
		let p = "";
		for (let i = 0; i < outputs.length; i++) {
			let output = outputs[i];
			p += "\n  [Addr: "+output.address+ " Value: "+output.value + "]";
		}
		return p;
	}
 
 	printTransaction(transaction) {
        	console.log(" Transaction "+ transaction.id +
			"\n Inputs "+ this.printOutputs(transaction.inputs) +
			 "\n Outputs "+ this.printOutputs(transaction.outputs) +
			 "\n Fee "+ transaction.fee
		);
	}








	getBalance() {
		let inputs = this.findInputs();
		let balance = 0;
		inputs.forEach(
			input => balance += input.value
		);
		return balance;
	}










}
module.exports=Wallet;
