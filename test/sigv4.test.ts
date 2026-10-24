import { test, expect } from 'vitest';
import { presign } from '../src/sigv4';

test('SigV4 预签名与 AWS 官方测试向量一致', async () => {
  // AWS 文档里的示例参数，签名值已与参考实现 aws4 交叉验证
  const url = await presign(
    {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    },
    {
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      expires: 86400,
      now: new Date('2013-05-24T00:00:00Z'),
    }
  );

  const expected =
    'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
    '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
    '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
    '&X-Amz-Signature=3ed0be64024db54d5574a27da223529635c383f911f80e636f0ccc13890053d2';

  expect(url).toBe(expected);
});
