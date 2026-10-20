function readProfilePhoto(dataUrl) {
    if (!dataUrl) return null
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match) throw new Error('Profile photo must be a PNG, JPEG, or WebP image')
    const buffer = Buffer.from(match[2], 'base64')
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) {
        throw new Error('Profile photo must be smaller than 2 MB')
    }
    return { buffer, mime: match[1] }
}

module.exports = { readProfilePhoto }
