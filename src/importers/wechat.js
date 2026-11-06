export const wechat = {
  id: 'wechat', name: '微信',
  matches: (headers) => headers.includes('交易对方') && headers.includes('商品') && headers.includes('交易类型'),
  fields: { time: ['交易时间'], merchant: ['交易对方'], description: ['商品'], amount: ['金额(元)', '金额（元）', '金额'], direction: ['收/支'], type: ['交易类型'], status: ['当前状态', '交易状态'], transactionId: ['交易单号'], },
}
