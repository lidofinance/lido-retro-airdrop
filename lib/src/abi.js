const truffleContract = require('@truffle/contract')

const abiByName = {}
const contractByName = {}

let provider

function setProvider(newProvider) {
  provider = newProvider

  Object.keys(contractByName).forEach(
    name => contractByName[name].setProvider(newProvider)
  )
}

function getContract(name) {
  if (contractByName[name]) {
    return contractByName[name]
  }
  const abi = getABI(name)
  const contract = truffleContract({ abi })
  if (provider) {
    contract.setProvider(provider)
  }
  return (contractByName[name] = contract)
}

function getABI(name) {
  return abiByName[name] || (abiByName[name] = require(`../abi/${name}.json`))
}

module.exports = { getABI, getContract, setProvider }
