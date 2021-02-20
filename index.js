const compression = require('compression')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const Block = require('./block')
const Blockchain = require('./blockchain')
const chain = new Blockchain()
const CertValidation = require('./cert-validation')

validateAddressParameter = async (req, res, next) => {
  try {
    const certValidation = new CertValidation(req)
    certValidation.validateAddressParameter()
    next()
  } catch (error) {
    res.status(400).json({
      status: 400,
      message: error.message
    })
  }
}

validateSignatureParameter = async (req, res, next) => {
  try {
    const certValidation = new CertValidation(req)
    certValidation.validateSignatureParameter()
    next()
  } catch (error) {
    res.status(400).json({
      status: 400,
      message: error.message
    })
  }
}

validateNewcertRequest = async (req, res, next) => {
  try {
    const certValidation = new CertValidation(req)
    certValidation.validateNewcertRequest()
    next()
  } catch (error) {
    res.status(400).json({
      status: 400,
      message: error.message
    })
  }
}

app.use(compression())
app.listen(8000, () => console.log('API listening on port 8000'))
app.use(bodyParser.json())
app.get('/', (req, res) => res.status(404).json({
  status: 404,
  message: 'Check the README.md for the accepted endpoints'
}))

/**
 * @description Criteria: Web API post endpoint validates request with JSON response.
 */
app.post('/requestValidation', [validateAddressParameter], async (req, res) => {
  const certValidation = new CertValidation(req)
  const address = req.body.address

  try {
    data = await certValidation.getPendingAddressRequest(address)
  } catch (error) {
    data = await certValidation.saveNewRequestValidation(address)
  }

  res.json(data)
})

/**
 * @description Criteria: Web API post endpoint validates message signature with JSON response.
 */
app.post('/message-signature/validate', [validateAddressParameter, validateSignatureParameter], async (req, res) => {
  const certValidation = new CertValidation(req)

  try {
    const { address, signature } = req.body
    const response = await certValidation.validateMessageSignature(address, signature)

    if (response.registercert) {
      res.json(response)
    } else {
      res.status(401).json(response)
    }
  } catch (error) {
    res.status(404).json({
      status: 404,
      message: error.message
    })
  }
})

/**
 * @description Criteria: cert registration Endpoint
 */
app.post('/block', [validateNewcertRequest], async (req, res) => {
  const certValidation = new CertValidation(req)

  try {
    const isValid = await certValidation.isValid()

    if (!isValid) {
      throw new Error('Signature is not valid')
    }
  } catch (error) {
    res.status(401).json({
      status: 401,
      message: error.message
    })

    return
  }

  const body = { address, cert } = req.body
  const title = cert.title

  body.cert = {
    date: cert.date,
    hash: cert.hash,
    title: new Buffer(title).toString('hex'),
    mag: cert.mag,
    con: cert.con
  }

  await chain.addBlock(new Block(body))
  const height = await chain.getBlockHeight()
  const response = await chain.getBlock(height)

  certValidation.invalidate(address)

  res.status(201).send(response)
})

/**
 * @description Criteria: Get cert block by cert block height with JSON response.
 */
app.get('/block/:height', async (req, res) => {
  try {
    const response = await chain.getBlock(req.params.height)

    res.send(response)
  } catch (error) {
    res.status(404).json({
      status: 404,
      message: 'Block not found'
    })
  }
})

/**
 * @description Criteria: Get cert block by wallet address (blockchain identity) with JSON response.
 */
app.get('/certs/address:address', async (req, res) => {
  try {
    const address = req.params.address.slice(1)
    const response = await chain.getBlocksByAddress(address)

    res.send(response)
  } catch (error) {
    res.status(404).json({
      status: 404,
      message: 'Block not found'
    })
  }
})

/**
 * @description Criteria: Get cert block by hash with JSON response.
 */
app.get('/certs/hash:hash', async (req, res) => {
  try {
    const hash = req.params.hash.slice(1)
    const response = await chain.getBlockByHash(hash)

    res.send(response)
  } catch (error) {
    res.status(404).json({
      status: 404,
      message: 'Block not found'
    })
  }
})
