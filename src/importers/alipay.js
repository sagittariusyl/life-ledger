export const alipay = {
  id: 'alipay', name: '支付宝',
  matches: (headers) => headers.includes('交易对方') && (headers.includes('商品名称') || headers.includes('商品说明')),
  fields: { time: ['交易时间', '付款时间', '交易创建时间'], merchant: ['交易对方'], description: ['商品名称', '商品说明'], amount: ['金额', '金额(元)', '金额（元）'], direction: ['收/支', '收支'], type: ['交易分类', '交易类型'], status: ['交易状态'], transactionId: ['交易订单号', '交易号'], },
}
