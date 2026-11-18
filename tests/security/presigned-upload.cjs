const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../../apps/api/node_modules/reflect-metadata');
const { ContentPublishService } = require('../../apps/api/dist/instagram/content-publish.service');

test('Direct Cloud Upload - Presigned URL generation', async (t) => {
  const mockPrisma = {
    postPublish: {
      create: async () => ({ id: 'post_123' }),
    },
  };
  const mockEncryption = {};

  const service = new ContentPublishService(mockPrisma, mockEncryption);

  await t.test('generates valid presigned direct-upload URL for 4K video reel', async () => {
    const res = await service.generatePresignedUploadUrl('usr_creator_99', {
      filename: 'my_viral_reel.mp4',
      contentType: 'video/mp4',
      fileSize: 150 * 1024 * 1024, // 150MB
    });

    assert.ok(res.uploadUrl, 'uploadUrl must be present');
    assert.ok(res.publicCdnUrl, 'publicCdnUrl must be present');
    assert.equal(res.method, 'PUT');
    assert.equal(res.headers['Content-Type'], 'video/mp4');
    assert.match(res.key, /^uploads\/usr_creator_99\/\d+_[a-f0-9]+\.mp4$/);
    assert.equal(res.expiresInSeconds, 900);
  });

  await t.test('sanitizes dangerous filenames and isolates paths per user', async () => {
    const res = await service.generatePresignedUploadUrl('usr_creator_42', {
      filename: '../../../etc/passwd.jpg',
      contentType: 'image/jpeg',
      fileSize: 2 * 1024 * 1024,
    });

    assert.ok(!res.key.includes('..'), 'Path traversal must be prevented');
    assert.match(res.key, /^uploads\/usr_creator_42\/\d+_[a-f0-9]+\.jpg$/);
    assert.equal(res.headers['Content-Type'], 'image/jpeg');
  });
});
