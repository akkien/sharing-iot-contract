const Migrations = artifacts.require('Migrations');
const AccessControl = artifacts.require('AccessControl');

module.exports = function(deployer) {
  deployer.deploy(AccessControl, 5, 30);
};
