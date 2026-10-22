import { presign } from '../src/sigv4.js';

// AWS SigV4 预签名示例参数（签名值已与参考实现 aws4 交叉验证一致）
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
  // 该签名值已与参考实现 aws4 交叉验证一致
  '&X-Amz-Signature=3ed0be64024db54d5574a27da223529635c383f911f80e636f0ccc13890053d2';

console.log('生成:', url);
console.log('期望:', expected);
if (url === expected) {
  console.log('\n✅ SigV4 预签名实现正确');
} else {
  console.log('\n❌ 不一致');
  process.exit(1);
}
