class Transaction {
	constructor (id,hash,inputs,outputs,fee) {
		this.id = id;
		this.hash = hash;
		this.inputs = inputs;
		this.outputs = outputs;

		this.fee = fee;	// Not included in transaction data
	}
}

class Output {
	constructor (address,value,signature) {
		this.address = address;
		this.value = value;
		this.signature = signature;
	}
}

module.exports = {
	Transaction,
	Output
}

