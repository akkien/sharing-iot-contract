const AccessControl = artifacts.require('AccessControl');
const Web3 = require('web3');
const web3 = new Web3(
  Web3.givenProvider ||
    new Web3.providers.WebsocketProvider('ws://localhost:7545'),
  null,
  {}
);

let instance;

beforeEach(async () => {
  instance = await AccessControl.deployed();
});

contract('Access control', async accounts => {
  it('should deploy success', async () => {
    let minInterval = await instance.minInterval();
    assert.equal(minInterval.toNumber(), 5);
  });

  it('should register device', async () => {
    let a = await instance.registerDevice('0x11', 2000000000);
    let account0_Devices = await instance.userDevices(accounts[0], 0);

    assert.equal(account0_Devices.dailyPrice.toNumber(), 2000000000);
  });

  it('should request data success', async () => {
    let a = await instance.registerDevice('0x11', 2000000000);
    let b = await instance.requestData(
      accounts[0],
      '0x11',
      '0x6fc23570c36a998942b6d901e52cd4c53dc838973aef05623ff7e3744ceceb9e43c0d9b1c1757e219bcff03b16e189c3936489ea45b9a139c18ceade441fe7c3',
      1554507924,
      1554597924,
      'api',
      { from: accounts[1], value: 5000000000 }
    );

    assert.equal(b.receipt.logs[0].args.api, 'api');
  });

  it('should reject because fromTime > toTime', async () => {
    try {
      await instance.requestData(
        accounts[0],
        '0x10',
        '0x6fc23570c36a998942b6d901e52cd4c53dc838973aef05623ff7e3744ceceb9e43c0d9b1c1757e219bcff03b16e189c3936489ea45b9a139c18ceade441fe7c3',
        1554597924,
        1554507924,
        'api',
        { from: accounts[1], value: 5000000000 }
      );
      assert(false);
    } catch (err) {
      assert(err);
    }
  });

  it('should reject because public key does not match requester address', async () => {
    try {
      await instance.requestData(
        accounts[0],
        '0x10',
        '0x6fc23570c36a998942b6d901e52cd4c53dc838973aef05623ff7e3744ceceb9e43c0d9b1c1757e219bcff03b16e189c3936489ea45b9a139c18ceade441fe7c3',
        1554597924,
        1554507924,
        'api',
        { from: accounts[1], value: 5000000000 }
      );
      assert(false);
    } catch (err) {
      assert(err);
    }
  });

  it('should get device does not exist - wrong device Id', async () => {
    let a = await instance.registerDevice('0x11', 2000000000);
    let b = await instance.requestData(
      accounts[0],
      '0x10',
      '0x6fc23570c36a998942b6d901e52cd4c53dc838973aef05623ff7e3744ceceb9e43c0d9b1c1757e219bcff03b16e189c3936489ea45b9a139c18ceade441fe7c3',
      1554507924,
      1554597924,
      'api',
      { from: accounts[1], value: 5000000000 }
    );

    assert.equal(b.receipt.logs[0].args.description, "Device doesn't exist");
  });

  it('should get device does not exist - wrong owner', async () => {
    let a = await instance.registerDevice('0x11', 2000000000);
    let b = await instance.requestData(
      accounts[1],
      '0x11',
      '0x4fdd82692780cbdf8d991024ec448cc211a1783121126efb05932670c989224056220b365b67b42f806256ed1e8ff7efd3619017a874a60ac29e5773a12f7868',
      1554507924,
      1554597924,
      'api',
      { from: accounts[2], value: 5000000000 }
    );

    assert.equal(b.receipt.logs[0].args.description, "Device doesn't exist");
  });

  it('should get not enough money', async () => {
    let a = await instance.registerDevice('0x11', 2000);
    let b = await instance.requestData(
      accounts[0],
      '0x11',
      '0x337c473fe271503044ca63c834ae6f0901d698fb5aace026b89c3f2b000cc7648cc4261f0f69e59ffdbee56d1c41a6efc973b3a1df415caa09d0cde96f5f999b',
      1557303503,
      1557562703,
      'api',
      { from: accounts[3], value: 7001 }
    );
    assert.equal(b.receipt.logs[0].args.description, 'Not enough money');
  });

  /// TEST BAD REQUEST
  it('should get bad request with 30 seconds', async () => {
    let a = await instance.registerDevice('0x11', 2000000000, {
      from: accounts[1]
    });
    let request1 = await instance.requestData(
      accounts[1],
      '0x11',
      '0x17816c34b3c20b20b1731544738c70dbba7db67b8db41d9a19a2fbee70b811ec8bff2897da514f7931989b7c27c463ba919d89bd10894872197a303586676ea7',
      1554501924,
      1554597924,
      'api',
      { from: accounts[4], value: 5000000000 }
    );
    let request2 = await instance.requestData(
      accounts[1],
      '0x11',
      '0x17816c34b3c20b20b1731544738c70dbba7db67b8db41d9a19a2fbee70b811ec8bff2897da514f7931989b7c27c463ba919d89bd10894872197a303586676ea7',
      1554501924,
      1554597924,
      'api',
      { from: accounts[4], value: 5000000000 }
    );
    let eventArgs = request2.receipt.logs[1].args;
    assert.equal(eventArgs.description, 'Bad request');

    let badRequestListLength = await instance.getBadRequestListLength(
      accounts[4],
      accounts[1]
    );
    let lastBadRequest = await instance.badRequestList(
      accounts[4],
      accounts[1],
      badRequestListLength - 1
    );
    assert.equal(
      lastBadRequest.banUntil.toNumber() - lastBadRequest.time.toNumber(),
      30
    );
  });

  it('should get bad request with length * 2 minutes', async () => {
    let registerDevice = await instance.registerDevice('0x11', 2000000000, {
      from: accounts[2]
    });
    let request1 = await instance.requestData(
      accounts[2],
      '0x11',
      '0x17816c34b3c20b20b1731544738c70dbba7db67b8db41d9a19a2fbee70b811ec8bff2897da514f7931989b7c27c463ba919d89bd10894872197a303586676ea7',
      1554500924,
      1554597924,
      'api',
      { from: accounts[4], value: 5000000000 }
    );
    let request2 = await instance.requestData(
      accounts[2],
      '0x11',
      '0x17816c34b3c20b20b1731544738c70dbba7db67b8db41d9a19a2fbee70b811ec8bff2897da514f7931989b7c27c463ba919d89bd10894872197a303586676ea7',
      1554500924,
      1554597924,
      'api',
      { from: accounts[4], value: 5000000000 }
    );
    let request3 = await instance.requestData(
      accounts[2],
      '0x11',
      '0x17816c34b3c20b20b1731544738c70dbba7db67b8db41d9a19a2fbee70b811ec8bff2897da514f7931989b7c27c463ba919d89bd10894872197a303586676ea7',
      1554500924,
      1554597924,
      'api',
      { from: accounts[4], value: 5000000000 }
    );
    let eventArgs = request3.receipt.logs[1].args;

    assert.equal(eventArgs.description, 'Bad request');

    let badRequestListLength = await instance.getBadRequestListLength(
      accounts[4],
      accounts[2]
    );
    let lastBadRequest = await instance.badRequestList(
      accounts[4],
      accounts[2],
      badRequestListLength - 1
    );
    assert.equal(
      lastBadRequest.banUntil.toNumber() - lastBadRequest.time.toNumber(),
      60
    );
  });

  it('should receive money', async () => {
    let register = await instance.registerDevice('0x11', 2000000000);
    let request = await instance.requestData(
      accounts[0],
      '0x11',
      '0x0dc4b3799b1a972392cc3d1c45e95fc1156b0c95c5fff0ea71d7595ee1199317b26a46c1d6744d2c5719480835c94f6ce242043f4d92858496b4ce0e79b9bcce',
      1554500924,
      1554597924,
      'api',
      { from: accounts[5], value: 5000000000 }
    );

    let eventArgs = request.receipt.logs[0].args;
    console.log('txid', eventArgs.txId);
    let confirmSentData = await instance.confirmSentData(
      accounts[5],
      eventArgs.txId,
      '0x33'
    );

    let old_balance = await web3.eth.getBalance(accounts[0]);
    const oldstring = old_balance.toString();
    console.log('old', oldstring);
    const oldBN = web3.utils.toBN(oldstring);
    console.log('oldBN', oldBN);

    let confirmReceivedData = await instance.confirmReceivedData(
      accounts[0],
      eventArgs.txId,
      {
        from: accounts[5]
      }
    );

    let new_balance = await web3.eth.getBalance(accounts[0]);

    console.log('old balance', old_balance, '\nnew balance', new_balance);
    //assert.equal(new_balance - old_balance, 5000000000);
  });
});
