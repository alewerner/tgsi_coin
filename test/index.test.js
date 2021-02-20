const test = require('ava')
const supertest = require('supertest')
const bitcoin = require('bitcoinjs-lib')
const bitcoinMessage = require('bitcoinjs-message')
const fs = require('fs');
const BASE_URL = 'http://localhost:8000'

test.before('Must specify BASE_URL', t => {
  t.truthy(BASE_URL)
})

const app = require('../index')

const keyPair = bitcoin.ECPair.makeRandom()
const privateKey = keyPair.d.toBuffer(32)
const address = keyPair.getAddress()

test.cb('1. /requestValidation: should return a message with validation window', (t) => {
  supertest(BASE_URL)
    .post('/requestValidation')
    .send({address: address})
    .expect(200)
    .expect((response) => {
      t.is(response.status, 200)
      t.is(response.body.address, address)
      t.is(response.body.validationWindow, 300)
      t.hasOwnProperty('requestTimeStamp')
      t.hasOwnProperty('message')

      const message = response.body.message
      const signature = bitcoinMessage.sign(message, privateKey, keyPair.compressed).toString('base64')

      fs.writeFileSync('./data/signature.txt', signature)
    })
    .end(t.end)
})

test.cb('2. /message-signature/validate: should return a valid register cert request', (t) => {
  setTimeout(() => {
    const signature = fs.readFileSync('./data/signature.txt').toString()

    supertest(BASE_URL)
      .post('/message-signature/validate')
      .send({address: address, signature: signature})
      .expect(200)
      .expect((response) => {
        t.is(response.body.registercert, true)
        t.hasOwnProperty('status')
      })
      .end(t.end)
  }, 1000)
})

test.cb('3. /block: will not register because missing date', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .post('/block')
      .send({
        address: address,
        cert: {
          hash: "d871465b3c2249c004e7350e63cf794c",
          title: `Test title of address ${address}`
        }
      })
      .expect(400)
      .expect((response) => {
        t.is(response.body.message, "Your cert information should include non-empty string properties 'date', 'hash' and 'title'")
      })
      .end(t.end)
  }, 2000)
})

test.cb('4. /block: will not register because missing hash', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .post('/block')
      .send({
        address: address,
        cert: {
          date: "07.12.2018",
          title: `Test title of address ${address}`
        }
      })
      .expect(400)
      .expect((response) => {
        t.is(response.body.message, "Your cert information should include non-empty string properties 'date', 'hash' and 'title'")
      })
      .end(t.end)
  }, 2000)
})

test.cb('5. /block: will not register because missing title', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .post('/block')
      .send({
        address: address,
        cert: {
          date: "07.12.2018",
          hash: "d871465b3c2249c004e7350e63cf794c"
        }
      })
      .expect(400)
      .expect((response) => {
        t.is(response.body.message, "Your cert information should include non-empty string properties 'date', 'hash' and 'title'")
      })
      .end(t.end)
  }, 2000)
})

test.cb('6. /block: should return the new block added', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .post('/block')
      .send({
        address: address,
        cert: {
          date: "07.12.2018",
          hash: "d871465b3c2249c004e7350e63cf794c",
          title: `Test title of address ${address}`}
        }
      )
      .expect(201)
      .expect((response) => {
        t.hasOwnProperty('hash')
        t.hasOwnProperty('height')
        t.hasOwnProperty('body')
        t.hasOwnProperty('time')
        t.hasOwnProperty('previousBlockHash')

        fs.writeFileSync('./data/hash.txt', response.body.hash)
      })
      .end(t.end)
  }, 2000)
})

test.cb('7. /block/height: should return the block by height', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .get('/block/1')
      .expect(200)
      .expect((response) => {
        t.hasOwnProperty('hash')
        t.hasOwnProperty('height')
        t.hasOwnProperty('body')
        t.hasOwnProperty('time')
        t.hasOwnProperty('previousBlockHash')
      })
      .end(t.end)
  }, 3000)
})

test.cb('8. /certs/hash:hash: should return the block by hash', (t) => {
  setTimeout(() => {
    const hash = fs.readFileSync('./data/hash.txt').toString()

    supertest(BASE_URL)
      .get(`/certs/hash:${hash}`)
      .expect(200)
      .expect((response) => {
        t.hasOwnProperty('hash')
        t.hasOwnProperty('height')
        t.hasOwnProperty('body')
        t.hasOwnProperty('time')
        t.hasOwnProperty('previousBlockHash')
      })
      .end(t.end)
  }, 3000)
})

test.cb('9. /certs/address:address: should return the block by address', (t) => {
  setTimeout(() => {
    supertest(BASE_URL)
      .get(`/certs/address:${address}`)
      .expect(200)
      .expect((response) => {
        t.hasOwnProperty('hash')
        t.hasOwnProperty('height')
        t.hasOwnProperty('body')
        t.hasOwnProperty('time')
        t.hasOwnProperty('previousBlockHash')
      })
      .end(t.end)
  }, 3000)
})
