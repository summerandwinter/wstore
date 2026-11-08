// Design-only proposals. These IDs never enter the production catalog or rotation.
export const proposalTemplates = Object.freeze([
  {
    id: 'moon', name: '月相', existing: false, proposal: true, recommendedFont: 'notoserif',
    description: '圆景如月 · 居中诗句',
    detail: { title: '把一轮山水，留在诗的上方', scene: '山水短诗 / 古典摘抄 / 安静的日常', structure: '圆形风景 / 居中诗行 / 对称落款', note: '长文缩小圆景并按实测适配；明确换行和完整出处始终保留。' },
  },
  {
    id: 'book', name: '书页', existing: false, proposal: true, recommendedFont: 'notoserif',
    description: '侧边小景 · 书页长文',
    detail: { title: '像翻开一本有山水的书', scene: '长篇书摘 / 序言 / 文字优先', structure: '书页引题 / 窄幅侧景 / 宽栏正文', note: '侧景只作小幅点睛；长文增加字栏宽度，保留可读字号与作者、书名。' },
  },
  {
    id: 'poster', name: '画报', existing: false, proposal: true, recommendedFont: 'notosans',
    description: '满版风景 · 不透明浅色文字板',
    detail: { title: '让风景铺满，让文字清楚', scene: '现代短句 / 风景照片 / 图文画报', structure: '全出血配图 / 四成侧栏或通宽底栏 / 清晰落款', note: '短句使用四成宽浅色侧栏；长文改为通宽底栏，始终使用不透明纸色而非低对比叠字。' },
  },
  {
    id: 'ticket', name: '旅笺', existing: false, proposal: true, recommendedFont: 'longcang',
    description: '上方风景 · 日期票根',
    detail: { title: '给今天的山水，留一张票根', scene: '旅行心绪 / 日常纪念 / 手写短句', structure: '票面上图 / 完整正文 / 齿孔分隔与日期存根', note: '日期在票根内真实排版，可独立隐藏；长文压缩上图，齿孔与落款不压住正文。' },
  },
  {
    id: 'collage', name: '折光', existing: false, proposal: true, recommendedFont: 'longcang',
    description: '错位叠纸 · 非对称图文',
    detail: { title: '一张风景，一页错落的心事', scene: '手写摘抄 / 日记 / 轻盈书摘', structure: '错位相片纸 / 叠放正文纸 / 非对称留白', note: '纸张边缘有意重叠，正文与配图互不遮挡；长文让正文纸扩展，配图随之缩小。' },
  },
  {
    id: 'excerpt', name: '摘录', existing: false, proposal: true, recommendedFont: 'notoserif',
    description: '醒目引号 · 文末小景',
    detail: { title: '把值得重读的话，认真摘下来', scene: '书摘 / 长段引文 / 思考与阅读', structure: '大引号起笔 / 宽栏可读正文 / 低位落款与小景', note: '引号是独立的真实文字装饰，不改写正文；出处完整保留，文末小景随长文收拢。' },
  },
]);
