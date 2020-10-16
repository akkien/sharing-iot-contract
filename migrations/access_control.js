var MyContract = artifacts.require("AcessControl");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(MyContract);
};
console.log('ok')