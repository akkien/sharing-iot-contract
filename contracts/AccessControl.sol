
pragma solidity ^ 0.5.0;
pragma experimental ABIEncoderV2;

contract AccessControl {

  uint public minInterval;
  address[] public users;
  uint public bTime;

  struct Device {
    bytes32 deviceId;
    uint dailyPrice;
  }

  struct BadRequest {
    address requester;
    address owner;
    bytes32 deviceId;
    uint time;
    uint banUntil;
  }

  struct Transaction {
    bytes32 txId;
    bytes32 dataHash;
    uint amount;
  }

  mapping(address => Device[]) public userDevices; // owner => Devices

  mapping(address => mapping(address => BadRequest[])) public badRequestList; // requester => owner => BadRequest

  mapping(address => mapping(address => uint)) public timeOfLastRequest; // requester => owner => time of last request

  mapping(address => mapping(address => Transaction[])) transactionList;

  event NewDeviceAdded(address indexed owner, bytes32 deviceId, uint dailyPrice);

  event RequestDataSuccess(address indexed requester, address indexed owner, bytes32 indexed deviceId, bytes publicKey, uint time, uint fromTime, uint toTime, string api, bytes32 txId);

  event RequestDataFail(address indexed requester, address indexed owner, bytes32 indexed deviceId, string description, uint money, uint time);

  event BadRequestOccured(address indexed requester, address indexed owner, bytes32 indexed deviceId, uint time, uint banUntil);

  event DataSent(address indexed requester, address indexed owner, bytes32 indexed txId, bytes32 dataHash);

  event DataReceived(address indexed requester, address indexed owner, bytes32 indexed txId);

  constructor(uint _minInterval, uint _bTime) public {
    minInterval = _minInterval;
    bTime = _bTime;
  }

  function registerDevice(bytes32 deviceId, uint dailyPrice) public {
    if (userDevices[msg.sender].length == 0) {
      users.push(msg.sender);
    }
    userDevices[msg.sender].push(Device(deviceId, dailyPrice));
    emit NewDeviceAdded(msg.sender, deviceId, dailyPrice);
  }

  function requestData(address owner, bytes32 _deviceId, bytes memory publicKey, uint fromTime, uint toTime, string memory api) public payable returns(bool)  {
    require(address(uint256 (keccak256 (publicKey))) == msg.sender);

    require(toTime <= now && toTime > fromTime, "Period you request is wrong");

    bool isDeviceExist = false;

    for (uint i = 0; i < userDevices[owner].length; i++) {

      if (userDevices[owner][i].deviceId == _deviceId) {
        isDeviceExist = true;

        if (dynamicCheck(msg.sender, owner, _deviceId) == 0) { // if banTime == 0
          
          if (msg.value >= (toTime - fromTime + 1 days - 1) / 1 days * userDevices[owner][i].dailyPrice) { // if enough money === success

            bytes32 txId = keccak256(abi.encodePacked(msg.sender, owner, now));
            transactionList[msg.sender][owner].push(Transaction(txId, '0x0', msg.value));

            timeOfLastRequest[msg.sender][owner] = now;

            emit RequestDataSuccess(msg.sender, owner, _deviceId, publicKey, now, fromTime, toTime, api, txId);
            return true;

          } else { // not enough money
            emit RequestDataFail(msg.sender, owner, _deviceId, "Not enough money", msg.value, now);
          }

        }
        else { // bad request
          emit RequestDataFail(msg.sender, owner, _deviceId, "Bad request", msg.value, now);
        }

        break;
      }
    }

    if (!isDeviceExist) { // device doesn't exist
      emit RequestDataFail(msg.sender, owner, _deviceId, "Device doesn't exist", msg.value, now);
    }

    timeOfLastRequest[msg.sender][owner] = now;
    return false;
  }

  function dynamicCheck(address requester, address owner, bytes32 _deviceId) private returns(uint){
    
    uint length = badRequestList[requester][owner].length;
    
    uint banTime = 0;
    if (length > 0) {
      BadRequest storage lastBadRequest = badRequestList[requester][owner][length - 1];
      uint banUntil = lastBadRequest.banUntil;

      if (now < banUntil) {
        banTime = 2 * (banUntil - lastBadRequest.time);
      }
      else {
        if ((now - timeOfLastRequest[requester][owner]) < minInterval) {
          banTime = bTime;
        }
      }
    }
    else {
      if ((now - timeOfLastRequest[requester][owner]) < minInterval) {
        banTime = bTime;
      }
    }

    if (banTime > 0) {
      emit BadRequestOccured(requester, owner, _deviceId, now, now + banTime);
      badRequestList[requester][owner].push(BadRequest(requester, owner, _deviceId, now, now + banTime));
    }
    return banTime;
  }

  function confirmSentData(address requester, bytes32 _txId, bytes32 dataHash) public {
    for (uint i = 0; i < transactionList[requester][msg.sender].length; i++) {
      if (transactionList[requester][msg.sender][i].txId == _txId) {
        transactionList[requester][msg.sender][i].dataHash = dataHash;
      }
    }
    emit DataSent(requester, msg.sender, _txId, dataHash);
  }

  function confirmReceivedData(address payable owner, bytes32 _txId) public {

    for (uint i = 0; i < transactionList[msg.sender][owner].length; i++) {
      if (transactionList[msg.sender][owner][i].txId == _txId) {
        owner.transfer(transactionList[msg.sender][owner][i].amount);
        transactionList[msg.sender][owner][i].amount = 0;
        emit DataReceived(msg.sender, owner, _txId);
      }
    }

  }

  function getUsers() public view returns(address[] memory){
    return users;
  }

  function getUserDevicesLength(address user) public view returns(uint) {
    return userDevices[user].length;
  }
  
  function getUserDevices(address user) public view returns(Device[] memory){
      return userDevices[user];
  }
  
  function getDeposit(address requester, bytes32 txId) public view returns(uint){
    for (uint i = 0; i < transactionList[requester][msg.sender].length; i++) {
      if (transactionList[requester][msg.sender][i].txId == txId) {
        return transactionList[requester][msg.sender][i].amount;
      }
    }
  }

  function getTransactionListLength(address requester, address owner) public view returns(uint){
    return transactionList[requester][owner].length;
  }

  function getBadRequestListLength(address requester, address owner) public view returns(uint){
    return badRequestList[requester][owner].length;
  }

  function getBadRequestList(address requester, address owner) public view returns(BadRequest[] memory){
    return badRequestList[requester][owner];
  }

}
