const db = require('level')('./data/cert')
const bitcoinMessage = require('bitcoinjs-message')

class CertValidation {
  constructor (req) {
    this.req = req
  }

  validateAddressParameter() {
    if (!this.req.body.address) {
      throw new Error('Fill the address parameter')
    }

    return true
  }

  validateSignatureParameter() {
    if (!this.req.body.signature) {
      throw new Error('Fill the signature parameter')
    }
  }

  validateNewcertRequest() {
    const MAX_STORY_BYTES = 500
    const { cert } = this.req.body
    const { date, hash, title} = cert

    if (!this.validateAddressParameter() || !this.req.body.cert) {
      throw new Error('Fill the address and cert parameters')
    }

    if (typeof date !== 'string' || typeof hash !== 'string' || typeof title !== 'string' || !date.length || !hash.length || !title.length) {
      throw new Error("Your cert information should include non-empty string properties 'date', 'hash' and 'title'")
    }

    if (new Buffer(title).length > MAX_STORY_BYTES) {
      throw new Error('Your cert title too is long. Maximum size is 500 bytes')
    }

    const isASCII = ((str) => /^[\x00-\x7F]*$/.test(str))

    if (!isASCII(title)) {
      throw new Error('Your cert title contains non-ASCII symbols')
    }
  }

  isValid() {
    return db.get(this.req.body.address)
      .then((value) => {
        value = JSON.parse(value)
        return value.messageSignature === 'valid'
      })
      .catch(() => {throw new Error('Not authorized')})
  }

  invalidate(address) {
    db.del(address)
  }

  async validateMessageSignature(address, signature) {
    return new Promise((resolve, reject) => {
      db.get(address, (error, value) => {
        if (value === undefined) {
          return reject(new Error('Not found'))
        } else if (error) {
          return reject(error)
        }

        value = JSON.parse(value)

        if (value.messageSignature === 'valid') {
          return resolve({
            registercert: true,
            status: value
        })
        } else {
          const nowSubFiveMinutes = Date.now() - (5 * 60 * 1000)
          const isExpired = value.requestTimeStamp < nowSubFiveMinutes
          let isValid = false

          if (isExpired) {
              value.validationWindow = 0
              value.messageSignature = 'Validation window was expired'
          } else {
              value.validationWindow = Math.floor((value.requestTimeStamp - nowSubFiveMinutes) / 1000)

              try {
                isValid = bitcoinMessage.verify(value.message, address, signature)
              } catch (error) {
                isValid = false
              }

              value.messageSignature = isValid ? 'valid' : 'invalid'
          }

          db.put(address, JSON.stringify(value))

          return resolve({
              registercert: !isExpired && isValid,
              status: value
          })
        }
      })
    })
  }

  saveNewRequestValidation (address) {
    const timestamp = Date.now()
    const message = `${address}:${timestamp}:certRegistry`
    const validationWindow = 300

    const data = {
      address: address,
      message: message,
      requestTimeStamp: timestamp,
      validationWindow: validationWindow
    }

    db.put(data.address, JSON.stringify(data))

    return data
  }

  async getPendingAddressRequest(address) {
    return new Promise((resolve, reject) => {
      db.get(address, (error, value) => {
        if (value === undefined) {
          return reject(new Error('Not found'))
        } else if (error) {
          return reject(error)
        }

        value = JSON.parse(value)

        const nowSubFiveMinutes = Date.now() - (5 * 60 * 1000)
        const isExpired = value.requestTimeStamp < nowSubFiveMinutes

        if (isExpired) {
            resolve(this.saveNewRequestValidation(address))
        } else {
          const data = {
            address: address,
            message: value.message,
            requestTimeStamp: value.requestTimeStamp,
            validationWindow: Math.floor((value.requestTimeStamp - nowSubFiveMinutes) / 1000)
          }

          resolve(data)
        }
      })
    })
  }
}

module.exports = CertValidation
