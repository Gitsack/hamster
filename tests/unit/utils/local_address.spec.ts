import { test } from '@japa/runner'
import { forwardedAddresses, isLocalAddress, isLocalRequest } from '#utils/local_address'

test.group('local_address | isLocalAddress', () => {
  test('private, loopback and link-local IPv4 are local', ({ assert }) => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.8.5',
      '169.254.1.1',
    ]) {
      assert.isTrue(isLocalAddress(ip), ip)
    }
  })

  test('public IPv4 and the edges of the private ranges are not local', ({ assert }) => {
    for (const ip of ['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '100.64.0.1']) {
      assert.isFalse(isLocalAddress(ip), ip)
    }
  })

  test('IPv4-mapped IPv6 is judged by the IPv4 address inside it', ({ assert }) => {
    assert.isTrue(isLocalAddress('::ffff:192.168.1.10'))
    assert.isFalse(isLocalAddress('::ffff:8.8.8.8'))
  })

  test('IPv6 loopback, unique local and link-local are local; global is not', ({ assert }) => {
    assert.isTrue(isLocalAddress('::1'))
    assert.isTrue(isLocalAddress('fd12:3456::1'))
    assert.isTrue(isLocalAddress('fe80::1%eth0'))
    assert.isFalse(isLocalAddress('2001:db8::1'))
  })

  test('addresses with ports, as Forwarded writes them, are understood', ({ assert }) => {
    assert.isTrue(isLocalAddress('192.168.1.2:4711'))
    assert.isTrue(isLocalAddress('[::1]:4711'))
  })

  test('garbage and missing values are not local', ({ assert }) => {
    for (const value of [undefined, null, '', 'unknown', '_hidden', 'localhost']) {
      assert.isFalse(isLocalAddress(value), String(value))
    }
  })
})

test.group('local_address | isLocalRequest', () => {
  test('a local peer with no forwarding headers is local', ({ assert }) => {
    assert.isTrue(isLocalRequest('192.168.8.5', []))
  })

  test('a proxy forwarding an internet client is not local', ({ assert }) => {
    const forwarded = forwardedAddresses({ forwardedFor: '203.0.113.7, 172.18.0.2' })
    assert.isFalse(isLocalRequest('172.18.0.2', forwarded))
  })

  test('a proxy forwarding a local client is local', ({ assert }) => {
    const forwarded = forwardedAddresses({ forwardedFor: '192.168.8.5' })
    assert.isTrue(isLocalRequest('172.18.0.2', forwarded))
  })

  test('a public peer is never local, whatever its headers claim', ({ assert }) => {
    const forwarded = forwardedAddresses({ forwardedFor: '127.0.0.1', realIp: '10.0.0.1' })
    assert.isFalse(isLocalRequest('203.0.113.7', forwarded))
  })

  test('every forwarding header counts, including Forwarded', ({ assert }) => {
    assert.isFalse(
      isLocalRequest(
        '10.0.0.2',
        forwardedAddresses({ forwarded: 'for="[2001:db8::1]";proto=https' })
      )
    )
    assert.isFalse(isLocalRequest('10.0.0.2', forwardedAddresses({ realIp: '198.51.100.1' })))
    assert.isFalse(isLocalRequest('10.0.0.2', forwardedAddresses({ forwarded: 'for=unknown' })))
  })
})
