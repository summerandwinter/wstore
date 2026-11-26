// Generated from shared/card-catalog.json; fontCatalog is the frozen compatibility set. Active fonts come from schema5.
export const templateDefinitions = [
  {
    "id": "paper",
    "name": "留白",
    "description": "上图下文",
    "existing": true,
    "recommendedFont": "wenkai",
    "group": "nature",
    "categories": [
      "诗词",
      "散文",
      "小说",
      "语录"
    ],
    "recommendedFonts": [
      "wenkai",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 12,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "daily_life",
        "belonging"
      ],
      "mood": [
        "calm",
        "reflective"
      ],
      "scene": [
        "mountain",
        "forest",
        "field"
      ],
      "element": [
        "tree",
        "cloud"
      ]
    }
  },
  {
    "id": "light",
    "name": "光影",
    "description": "整图沉浸",
    "existing": true,
    "recommendedFont": "notosans",
    "group": "imagery",
    "categories": [
      "台词",
      "歌词",
      "语录",
      "动漫",
      "游戏"
    ],
    "recommendedFonts": [
      "notosans",
      "wenkai"
    ],
    "longTextFont": "notosans",
    "preferredLength": {
      "min": 8,
      "max": 60
    },
    "semanticPreferences": {
      "theme": [
        "longing",
        "freedom"
      ],
      "mood": [
        "melancholic",
        "tense"
      ],
      "scene": [
        "city",
        "sea",
        "sky"
      ],
      "element": [
        "moon",
        "person"
      ]
    }
  },
  {
    "id": "type",
    "name": "字笺",
    "description": "文字为主",
    "existing": true,
    "recommendedFont": "xiaowei",
    "group": "text",
    "categories": [
      "小说",
      "散文",
      "语录"
    ],
    "recommendedFonts": [
      "xiaowei",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 50,
      "max": 240
    },
    "semanticPreferences": {
      "theme": [
        "acceptance",
        "self_worth"
      ],
      "mood": [
        "reflective",
        "calm"
      ],
      "scene": [
        "abstract",
        "indoor"
      ],
      "element": []
    }
  },
  {
    "id": "window",
    "name": "窗景",
    "description": "拱窗配图 · 居中短句",
    "recommendedFont": "notoserif",
    "group": "nature",
    "categories": [
      "诗词",
      "散文"
    ],
    "recommendedFonts": [
      "notoserif",
      "wenkai"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 8,
      "max": 48
    },
    "semanticPreferences": {
      "theme": [
        "acceptance",
        "belonging"
      ],
      "mood": [
        "calm"
      ],
      "scene": [
        "mountain",
        "sky",
        "forest"
      ],
      "element": [
        "window",
        "cloud",
        "tree"
      ]
    }
  },
  {
    "id": "letter",
    "name": "信笺",
    "description": "信头留白 · 小幅落款图",
    "recommendedFont": "longcang",
    "group": "text",
    "categories": [
      "散文",
      "小说",
      "语录"
    ],
    "recommendedFonts": [
      "longcang",
      "wenkai"
    ],
    "longTextFont": "wenkai",
    "preferredLength": {
      "min": 12,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "daily_life",
        "self_worth",
        "hope"
      ],
      "mood": [
        "reflective",
        "hopeful"
      ],
      "scene": [
        "indoor",
        "abstract"
      ],
      "element": [
        "window",
        "flower"
      ]
    }
  },
  {
    "id": "vertical",
    "name": "题签",
    "description": "右起竖排 · 长句横排",
    "recommendedFont": "mashanzheng",
    "group": "editorial",
    "categories": [
      "诗词"
    ],
    "recommendedFonts": [
      "mashanzheng",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 4,
      "max": 42
    },
    "semanticPreferences": {
      "theme": [
        "self_worth",
        "acceptance"
      ],
      "mood": [
        "reflective",
        "calm"
      ],
      "scene": [
        "mountain",
        "forest",
        "abstract"
      ],
      "element": [
        "water",
        "moon"
      ]
    }
  },
  {
    "id": "split",
    "name": "对页",
    "description": "左右分栏 · 半幅风景",
    "recommendedFont": "notosans",
    "group": "imagery",
    "categories": [
      "小说",
      "散文",
      "台词",
      "语录"
    ],
    "recommendedFonts": [
      "notosans",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 20,
      "max": 160
    },
    "semanticPreferences": {
      "theme": [
        "freedom",
        "daily_life"
      ],
      "mood": [
        "reflective",
        "calm"
      ],
      "scene": [
        "city",
        "indoor",
        "sea"
      ],
      "element": [
        "window",
        "building"
      ]
    }
  },
  {
    "id": "horizon",
    "name": "晴野",
    "description": "上文下景 · 日期锚点",
    "recommendedFont": "wenkai",
    "group": "nature",
    "categories": [
      "诗词",
      "歌词",
      "散文",
      "语录"
    ],
    "recommendedFonts": [
      "wenkai",
      "notosans"
    ],
    "longTextFont": "wenkai",
    "preferredLength": {
      "min": 8,
      "max": 80
    },
    "semanticPreferences": {
      "theme": [
        "hope",
        "growth",
        "freedom"
      ],
      "mood": [
        "hopeful",
        "joyful"
      ],
      "scene": [
        "field",
        "sky",
        "sea"
      ],
      "element": [
        "sun",
        "cloud",
        "flower"
      ]
    }
  },
  {
    "id": "photo",
    "name": "留影",
    "description": "相纸画框 · 书写注脚",
    "recommendedFont": "longcang",
    "group": "imagery",
    "categories": [
      "散文",
      "小说",
      "歌词",
      "台词"
    ],
    "recommendedFonts": [
      "longcang",
      "wenkai"
    ],
    "longTextFont": "wenkai",
    "preferredLength": {
      "min": 8,
      "max": 72
    },
    "semanticPreferences": {
      "theme": [
        "farewell",
        "belonging",
        "longing"
      ],
      "mood": [
        "melancholic",
        "reflective"
      ],
      "scene": [
        "city",
        "indoor",
        "field"
      ],
      "element": [
        "person",
        "road",
        "building"
      ]
    }
  },
  {
    "id": "moon",
    "name": "月相",
    "description": "圆形风景 · 居中诗句",
    "recommendedFont": "notoserif",
    "group": "nature",
    "categories": [
      "诗词",
      "歌词"
    ],
    "recommendedFonts": [
      "notoserif",
      "wenkai"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 6,
      "max": 48
    },
    "semanticPreferences": {
      "theme": [
        "longing",
        "acceptance"
      ],
      "mood": [
        "calm",
        "melancholic"
      ],
      "scene": [
        "sky",
        "mountain",
        "forest"
      ],
      "element": [
        "moon",
        "cloud",
        "water"
      ]
    }
  },
  {
    "id": "book",
    "name": "书页",
    "description": "书页引题 · 宽栏正文",
    "recommendedFont": "notoserif",
    "group": "text",
    "categories": [
      "小说",
      "散文",
      "语录"
    ],
    "recommendedFonts": [
      "notoserif",
      "xiaowei"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 60,
      "max": 240
    },
    "semanticPreferences": {
      "theme": [
        "self_worth",
        "acceptance",
        "growth"
      ],
      "mood": [
        "reflective"
      ],
      "scene": [
        "abstract",
        "indoor"
      ],
      "element": [
        "window"
      ]
    }
  },
  {
    "id": "poster",
    "name": "画报",
    "description": "全幅风景 · 独立文字栏",
    "recommendedFont": "notosans",
    "group": "imagery",
    "categories": [
      "台词",
      "歌词",
      "语录",
      "动漫",
      "游戏"
    ],
    "recommendedFonts": [
      "notosans",
      "wenkai"
    ],
    "longTextFont": "notosans",
    "preferredLength": {
      "min": 8,
      "max": 70
    },
    "semanticPreferences": {
      "theme": [
        "freedom",
        "self_worth"
      ],
      "mood": [
        "joyful",
        "tense",
        "hopeful"
      ],
      "scene": [
        "city",
        "sky",
        "sea"
      ],
      "element": [
        "person",
        "building",
        "sun"
      ]
    }
  },
  {
    "id": "ticket",
    "name": "旅笺",
    "description": "旅行票根 · 日期存根",
    "recommendedFont": "longcang",
    "group": "editorial",
    "categories": [
      "散文",
      "小说",
      "台词",
      "歌词"
    ],
    "recommendedFonts": [
      "longcang",
      "wenkai"
    ],
    "longTextFont": "wenkai",
    "preferredLength": {
      "min": 12,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "farewell",
        "freedom",
        "belonging"
      ],
      "mood": [
        "reflective",
        "hopeful"
      ],
      "scene": [
        "city",
        "sea",
        "field"
      ],
      "element": [
        "road",
        "person",
        "building"
      ]
    }
  },
  {
    "id": "collage",
    "name": "折光",
    "description": "错位纸片 · 非对称图文",
    "recommendedFont": "longcang",
    "group": "editorial",
    "categories": [
      "歌词",
      "语录",
      "动漫",
      "游戏",
      "散文"
    ],
    "recommendedFonts": [
      "longcang",
      "wenkai"
    ],
    "longTextFont": "wenkai",
    "preferredLength": {
      "min": 8,
      "max": 80
    },
    "semanticPreferences": {
      "theme": [
        "hope",
        "growth",
        "daily_life"
      ],
      "mood": [
        "joyful",
        "hopeful"
      ],
      "scene": [
        "field",
        "indoor",
        "sky"
      ],
      "element": [
        "flower",
        "sun",
        "tree"
      ]
    }
  },
  {
    "id": "excerpt",
    "name": "摘录",
    "description": "引号起笔 · 分级正文",
    "recommendedFont": "notoserif",
    "group": "text",
    "categories": [
      "语录",
      "小说",
      "散文",
      "台词"
    ],
    "recommendedFonts": [
      "notoserif",
      "xiaowei"
    ],
    "longTextFont": "notoserif",
    "preferredLength": {
      "min": 40,
      "max": 240
    },
    "semanticPreferences": {
      "theme": [
        "self_worth",
        "acceptance",
        "growth"
      ],
      "mood": [
        "reflective",
        "calm"
      ],
      "scene": [
        "abstract",
        "indoor"
      ],
      "element": []
    }
  },
  {
    "id": "ribbon",
    "name": "书签",
    "description": "细幅风景 · 书签色带 · 右侧横排",
    "recommendedFont": "wenkai",
    "group": "text",
    "categories": [
      "诗词",
      "散文",
      "小说"
    ],
    "recommendedFonts": [
      "wenkai",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "fontDirections": [
      "清秀楷体",
      "柔和手写"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 12,
      "max": 120
    },
    "semanticPreferences": {
      "theme": [
        "daily_life",
        "belonging"
      ],
      "mood": [
        "calm",
        "reflective"
      ],
      "scene": [
        "forest",
        "indoor",
        "mountain"
      ],
      "element": [
        "tree",
        "window"
      ]
    },
    "detail": {
      "title": "为读过的一页，留一枚书签",
      "scene": "阅读摘抄 / 日常片段 / 温柔短诗",
      "structure": "细长图窗靠左，书签色带压住上沿；横排文字独立成栏",
      "note": "长文拓宽正文，图片收窄，正文与出处完整保留"
    }
  },
  {
    "id": "ledger",
    "name": "札记",
    "description": "页边编号 · 细横图 · 手札行距",
    "recommendedFont": "notoserif",
    "group": "editorial",
    "categories": [
      "散文",
      "小说",
      "语录"
    ],
    "recommendedFonts": [
      "notoserif",
      "wenkai"
    ],
    "longTextFont": "notoserif",
    "fontDirections": [
      "宋体正文",
      "轻盈手写"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 40,
      "max": 240
    },
    "semanticPreferences": {
      "theme": [
        "growth",
        "daily_life",
        "self_worth"
      ],
      "mood": [
        "reflective",
        "calm"
      ],
      "scene": [
        "indoor",
        "abstract"
      ],
      "element": [
        "window"
      ]
    },
    "detail": {
      "title": "像翻开一本随身手札",
      "scene": "生活观察 / 长段摘抄 / 思考记录",
      "structure": "细横景、独立页边编号与宽栏正文，浅线跟随实际文字行距",
      "note": "长文压低横图，行距按测量结果铺开，编号不混入正文"
    }
  },
  {
    "id": "stamp",
    "name": "邮笺",
    "description": "航空信边 · 齿孔图章 · 寄语留白",
    "recommendedFont": "longcang",
    "group": "editorial",
    "categories": [
      "散文",
      "歌词",
      "语录"
    ],
    "recommendedFonts": [
      "longcang",
      "wenkai"
    ],
    "longTextFont": "wenkai",
    "fontDirections": [
      "随性手写",
      "圆润展示体"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 8,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "hope",
        "farewell",
        "belonging"
      ],
      "mood": [
        "hopeful",
        "reflective"
      ],
      "scene": [
        "field",
        "city",
        "sea"
      ],
      "element": [
        "road",
        "flower"
      ]
    },
    "detail": {
      "title": "把今天，寄给未来的自己",
      "scene": "祝福寄语 / 旅行记忆 / 自我鼓励",
      "structure": "双色信封边、右上齿孔图章与完整下方寄语，日期位于信头",
      "note": "图章随正文长度缩小，正文不绕排进图片，不截断落款"
    }
  },
  {
    "id": "album",
    "name": "画廊",
    "description": "连续三联景 · 深色展墙 · 作品注脚",
    "recommendedFont": "notosans",
    "group": "imagery",
    "categories": [
      "台词",
      "歌词",
      "散文",
      "语录"
    ],
    "recommendedFonts": [
      "notosans",
      "notoserif"
    ],
    "longTextFont": "notosans",
    "fontDirections": [
      "现代黑体",
      "克制宋体"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 8,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "freedom",
        "longing",
        "belonging"
      ],
      "mood": [
        "reflective",
        "melancholic"
      ],
      "scene": [
        "sea",
        "city",
        "mountain"
      ],
      "element": [
        "person",
        "road",
        "cloud"
      ]
    },
    "detail": {
      "title": "让一幅风景，展开为三个片段",
      "scene": "旅行 / 影像记忆 / 电影台词",
      "structure": "同一配图连续裁切为三联展框，深色底与底部浅色正文",
      "note": "三联共用一张真实图片，长文减少展框高度，为全文留足空间"
    }
  },
  {
    "id": "season",
    "name": "时序",
    "description": "日历数字 · 时间刻度 · 右下圆景",
    "recommendedFont": "wenkai",
    "group": "nature",
    "categories": [
      "诗词",
      "散文",
      "语录"
    ],
    "recommendedFonts": [
      "wenkai",
      "notoserif"
    ],
    "longTextFont": "notoserif",
    "fontDirections": [
      "清爽楷体",
      "亲切圆体"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 8,
      "max": 100
    },
    "semanticPreferences": {
      "theme": [
        "growth",
        "hope",
        "daily_life"
      ],
      "mood": [
        "calm",
        "hopeful"
      ],
      "scene": [
        "field",
        "forest",
        "sky"
      ],
      "element": [
        "sun",
        "flower",
        "tree"
      ]
    },
    "detail": {
      "title": "沿着日子的刻度，留住一点光",
      "scene": "节气 / 成长 / 每日心情",
      "structure": "日历大字与侧边刻度形成时间轴，圆景落在右下方",
      "note": "隐藏日期时不制造日期内容，长文让圆景移向右下并缩小"
    }
  },
  {
    "id": "verse",
    "name": "诗行",
    "description": "深蓝诗页 · 细金边线 · 底部全宽景",
    "recommendedFont": "notoserif",
    "group": "text",
    "categories": [
      "诗词",
      "歌词",
      "散文"
    ],
    "recommendedFonts": [
      "notoserif",
      "mashanzheng"
    ],
    "longTextFont": "notoserif",
    "fontDirections": [
      "端正宋体",
      "笔意楷书"
    ],
    "collection": "new",
    "preferredLength": {
      "min": 4,
      "max": 80
    },
    "semanticPreferences": {
      "theme": [
        "longing",
        "acceptance"
      ],
      "mood": [
        "calm",
        "reflective"
      ],
      "scene": [
        "sky",
        "mountain",
        "sea"
      ],
      "element": [
        "moon",
        "water",
        "cloud"
      ]
    },
    "detail": {
      "title": "在字与字之间，留一阵风",
      "scene": "分行诗 / 夜色短句 / 安静独白",
      "structure": "居中诗行、细金框线与贴底的全宽风景，深蓝衬托字形",
      "note": "保留显式换行，长文扩大文字区域，图片收成底部横带"
    }
  }
];
export const TEMPLATE_IDS = templateDefinitions.map(row => row.id);
export const fontCatalog = [
  {
    "id": "system",
    "name": "系统字体",
    "family": "system",
    "role": "sans",
    "description": "兼容与完整字形",
    "existing": true
  },
  {
    "id": "wenkai",
    "name": "拾光文楷",
    "family": "DaylightWenkai",
    "role": "serif",
    "description": "源自霞鹜文楷 TC · OFL",
    "existing": true
  },
  {
    "id": "xiaowei",
    "name": "拾光小薇",
    "family": "DaylightXiaowei",
    "role": "serif",
    "description": "源自站酷小薇体 · OFL",
    "existing": true
  },
  {
    "id": "notoserif",
    "name": "拾光宋体",
    "family": "DaylightNotoSerif",
    "role": "serif",
    "description": "源自 Noto Serif SC · OFL"
  },
  {
    "id": "notosans",
    "name": "拾光黑体",
    "family": "DaylightNotoSans",
    "role": "sans",
    "description": "源自 Noto Sans SC · OFL"
  },
  {
    "id": "mashanzheng",
    "name": "拾光楷书",
    "family": "DaylightMaShanZheng",
    "role": "handwriting",
    "description": "源自 Ma Shan Zheng · 短句优先 · OFL"
  },
  {
    "id": "longcang",
    "name": "拾光手写",
    "family": "DaylightLongCang",
    "role": "handwriting",
    "description": "源自 Long Cang · 短句优先 · OFL"
  }
];
