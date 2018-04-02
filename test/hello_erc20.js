const BigNumber = web3.BigNumber;
const mlog = require('mocha-logger');
const util = require('util');

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const HelloErc20 = artifacts.require('HelloERC20');

contract('HelloERC20', ([owner, holder, receiver, nilAddress, accountWith99]) => {
  const TOKEN_COUNT = 1000000;

  beforeEach(async () => {
    this.hello_erc20 = await HelloErc20.new({ from: owner });
  });
  describe('Given that I have a Token Contract', () => {
    it('it should have the correct name', async () => {
      const name = await this.hello_erc20.name();
      name.should.be.equal("Hello ERC20 Coin");
    });
    it('it should have the correct symbol', async () => {
      const symbol = await this.hello_erc20.symbol();
      symbol.should.be.equal("HE2");
    });
    it('it should have the correct decimal level', async () => {
      const decimals = await this.hello_erc20.decimals();
      decimals.should.be.bignumber.equal(18);
    });

    describe('Given that I have a fixed supply of tokens', () => {
      it('it should return the total supply of tokens for the Contract', async () => {
        const supply = await this.hello_erc20.totalSupply();
        supply.should.be.bignumber.equal(toWei(TOKEN_COUNT));
      });
      it('the owner should have all the tokens when the Contract is created', async () => {
        const balance = await this.hello_erc20.balanceOf(owner);
        balance.should.be.bignumber.equal(toWei(TOKEN_COUNT));
      });
      it('any account should have the tokens transfered to it', async () => {
        const amount = toWei(10);
        await this.hello_erc20.transfer(holder, amount)
        const balance = await this.hello_erc20.balanceOf(holder);
        balance.should.be.bignumber.equal(amount);
      });
      it('an address that has no tokens should return a balance of zero', async () => {
        const balance = await this.hello_erc20.balanceOf(nilAddress);
        balance.should.be.bignumber.equal(0);
      });
      describe('Given that I want to be able to transfer tokens', () => {
        it('it should not let me transfer tokens to myself', async () => {
          var hasError = true;
          try {
            const amount = toWei(10);
            await this.hello_erc20.transfer(owner, amount, { from: owner })
            hasError = false; // Should be unreachable
          } catch(err) { }
          assert.equal(true, hasError, "Function not throwing exception on transfer to self");
        });
        it('it should not let someone transfer tokens they do not have', async () => {
          var hasError = true;
          try {
            await this.hello_erc20.transfer(holder, toWei(10), { from: owner })
            await this.hello_erc20.transfer(receiver, toWei(20), { from: holder })
            hasError = false;
          } catch(err) { }
          assert.equal(true, hasError, "Insufficient funds");
        });
        it('it should emit a Transfer Event', async () => {
          const amount = toWei(10);
          const { logs } = await this.hello_erc20.transfer(holder, amount, { from: owner });

          assert.equal(logs.length, 1, 'No Transfer Event emitted');
          assert.equal(logs[0].event, 'Transfer');
          assert.equal(logs[0].args.from, owner);
          assert.equal(logs[0].args.to, holder);
          assert.equal(logs[0].args.tokens, amount);
        });

        describe('Given that I want to allow the transfer of tokens by a third party', () => {
          it('allowance should return the amount I allow them to transfer', async () => {
            const amount = toWei(99);
            await this.hello_erc20.approve(holder, amount, { from: owner });
            const remaining = await this.hello_erc20.allowance(owner, holder);
            remaining.should.be.bignumber.equal(amount);
          });
          it('allowance should return the amount another allows a third account to transfer', async () => {
            const amount = toWei(98);
            await this.hello_erc20.transfer(holder, toWei(100))
            await this.hello_erc20.approve(receiver, amount, { from: holder });
            const remaining = await this.hello_erc20.allowance(holder, receiver);
            remaining.should.be.bignumber.equal(amount);
          });
          it('allowance should return zero if none have been approved for the account', async () => {
            const remaining = await this.hello_erc20.allowance(owner, nilAddress);
            remaining.should.be.bignumber.equal(0);
          });
          it('it should emit an Approval event when the approve method is successfully called', async () => {
            const amount = toWei(97);
            const { logs } = await this.hello_erc20.approve(holder, amount, { from: owner });

            assert.equal(logs.length, 1, 'No Approval Event emitted');
            assert.equal(logs[0].event, 'Approval');
            assert.equal(logs[0].args.tokenOwner, owner);
            assert.equal(logs[0].args.spender, holder);
            assert.equal(logs[0].args.tokens, amount);
          });
          it('transferFrom should transfer tokens when triggered by an approved third party', async () => {
            const tokenAmount = 96;
            const amount = toWei(tokenAmount);
            await this.hello_erc20.approve(holder, amount, { from: owner });
            await this.hello_erc20.transferFrom(owner, receiver, amount, { from: holder });
            const balance = await this.hello_erc20.balanceOf(receiver, { from: receiver });

            balance.should.be.bignumber.equal(toWei(tokenAmount));
          });
          it('the account funds are being transferred from should have sufficient funds', async () => {
            var hasError = true;
            try {
              const balance99 = toWei(99);
              await this.hello_erc20.transfer(accountWith99, balance99, { from: owner })
              const balance = await this.hello_erc20.balanceOf(accountWith99);
              balance.should.be.bignumber.equal(balance99);
              const amount = toWei(100);

              await this.hello_erc20.approve(receiver, amount, { from: accountWith99 });
              await this.hello_erc20.transferFrom(accountWith99, nilAddress, amount, { from: receiver });
              asError = false;
            } catch(err) { }
            assert.equal(true, hasError, "Function not throwing exception for insufficient funds");
          });
          it('should throw exception when attempting to transferFrom unauthorized account', async () => {
            var hasError = true;
            try {
              const remaining = await this.hello_erc20.allowance(owner, nilAddress);
              remaining.should.be.bignumber.equal(toWei(0));
              var holderBalance = await this.hello_erc20.balanceOf(holder);
              holderBalance.should.be.bignumber.equal(toWei(0));
              const amount = toWei(101);

              await this.hello_erc20.transferFrom(owner, holder, amount, { from: nilAddress });
              asError = false;
            } catch(err) { }
            assert.equal(true, hasError, "Unauthorized account should not be allowed transfer funds.");
          });
          it('An authorized accounts allowance should go down when transferFrom is called', async () => {
            const amount = toWei(15);
            await this.hello_erc20.approve(holder, amount, { from: owner });
            var allowance = await this.hello_erc20.allowance(owner, holder);
            allowance.should.be.bignumber.equal(amount);

            await this.hello_erc20.transferFrom(owner, receiver, toWei(7), { from: holder });

            allowance = await this.hello_erc20.allowance(owner, holder);
            allowance.should.be.bignumber.equal(toWei(8));
          });
        });
      });
    });
  });
});

function toWei(count) {
  return count * 10 ** 18
}
