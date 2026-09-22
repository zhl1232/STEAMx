export type LearningTopicSlug = "blocks" | "scratch" | "science" | "nature";

export interface LearningTopicDefinition {
    slug: LearningTopicSlug;
    label: string;
    title: string;
    description: string;
    introduction: string;
    concepts?: Array<{ title: string; description: string }>;
    equipmentSets?: Array<{ code: string; name: string; use: string; sourceUrl: string }>;
    firstQuestion: string;
    firstChallenge: string;
    preparation: string[];
    sequence: Array<{ title: string; description: string }>;
    reflection: string[];
    companionNote: string;
    resourceHeading: string;
    resourceIntroduction: string;
    browseHref: string;
    browseLabel: string;
    keywords: string[];
}

/** Public learning guides; keep each topic useful independently of the current catalog. */
export const LEARNING_TOPICS: readonly LearningTopicDefinition[] = [
    {
        slug: "blocks",
        label: "积木搭建",
        title: "少儿积木搭建入门：准备零件、读懂步骤与改进结构",
        description: "从一件想搭的作品开始，了解积木搭建需要准备什么、怎样读懂分步说明，以及如何检查连接、测试稳定性并改进作品。继续进入创探空间的积木课程。",
        introduction: "积木套装按主要用途可分为娱乐类和教育类，都能让孩子在玩中学习。创探空间使用教育套装，从有趣的作品出发，通过搭建、测试和改进，探索怎样搭得牢、站得稳、动得起来。",
        concepts: [
            { title: "互锁：让上下两层错开接缝", description: "像砌砖墙一样，让上层的一块积木跨过下层两块积木的接缝，把它们连在一起。与每层接缝都对齐的搭法相比，这通常能减少沿接缝分开的情况。先比较两种搭法，再说说哪一种更牢。" },
            { title: "底座与重心：让作品站得稳", description: "连接牢固不等于不会倒。试着把底座加宽，或把较重的部分放低、放在支撑范围内，再轻推比较。一次只改一个条件，观察是连接松了，还是整件作品倾倒了。" },
            { title: "支撑与加固：找出容易变形的地方", description: "桥面下垂、墙面晃动时，先找到变形的位置，再尝试增加支柱、加厚连接或用横向积木连住两侧。加固后重新测试，也留意是否挡住了原本需要运动的部分。" },
            { title: "轮轴与齿轮：观察运动怎样传递", description: "转动车轮和齿轮，观察哪些零件跟着动、方向是否改变。两个直接啮合的外齿轮转向相反；在同样的驱动条件下，换用不同大小的齿轮，再比较转动圈数和速度。" },
        ],
        equipmentSets: [
            { code: "9090", name: "大颗粒基础积木套装", use: "以基础砖块和造型零件搭建建筑、动物与生活场景，适合练习连接、互锁和空间组合。", sourceUrl: "https://le-www-live-s.legocdn.com/sc/media/files/catalogs/2016-preschool-catalog-us-da56dc1b07e890484862b160620d3851.pdf" },
            { code: "9076", name: "管道实验套装", use: "用管道、球和支撑零件搭建通路，探索位置、路径和因果关系。", sourceUrl: "https://le-www-live-s.legocdn.com/sc/media/files/catalogs/2016-preschool-catalog-us-da56dc1b07e890484862b160620d3851.pdf" },
            { code: "9656", name: "早期简单机械套装", use: "围绕齿轮、杠杆、滑轮、轮与轴开展搭建，观察简单机械怎样传递运动。", sourceUrl: "https://www.lego.com/en-no/product/early-simple-machines-set-9656" },
            { code: "45002", name: "科技机械套装", use: "搭建车辆与机械模型，在装配和测试中练习设计与解决问题。", sourceUrl: "https://education.lego.com/en-us/products/tech-machines-set-with-storage-by-lego-education/45002/" },
        ],
        firstQuestion: "同样的积木，怎样搭才更稳？",
        firstChallenge: "用相同数量的长方形积木搭两面矮墙：一面上下接缝对齐，一面让上层跨过下层接缝。尽量保持高度和厚度一致，用相近的力轻推，比较哪里先松动。再试着只加宽底座，看看连接牢固和不易倾倒有什么不同。",
        preparation: [
            "先看选中课时的零件清单，核对形状、数量和连接方式；已有积木能否替代，要以这节课的实际结构为准。",
            "留出平整的搭建位置，把零件按形状分开放；小颗粒零件由家长结合孩子的使用能力选择和陪伴。",
            "准备纸笔或拍照设备，记下第一版和修改后的不同。看步骤时可以用电脑或平板，把实物放在屏幕旁边对照。",
        ],
        sequence: [
            { title: "先观察，认清要搭什么", description: "看成品和生活中的对应物，找出底座、支撑、连接等部分。让孩子选一个自己想验证的问题，比如底座宽一点会怎样。" },
            { title: "按步骤搭出第一版", description: "一次对照一个步骤，先找零件，再看方向和连接位置。遇到装不上或不对称时，退回上一步检查，不急着把所有零件都拼完。" },
            { title: "动手测试，只改一处", description: "根据作品选择站立、转动或滚动等测试。发现问题后只调整一处结构，比较修改前后的表现，让孩子说出自己的判断依据。" },
            { title: "把改进讲给别人听", description: "保留照片或简单草图，说明原来哪里不顺、改了什么、结果怎样。也可以和同伴交换作品，请对方试用并提出下一次改进的建议。" },
        ],
        reflection: ["哪一处连接最容易松？你是怎么发现的？", "修改后更稳了吗？还可以用什么办法验证？", "换成另一种零件，你会怎样调整结构？"],
        companionNote: "陪伴时先问“你想试哪一种办法”，把观察和动手的机会留给孩子。需要帮忙时，可以一起找零件或回看步骤，再由孩子决定下一次怎么改。",
        resourceHeading: "从一节积木课开始",
        resourceIntroduction: "打开课程查看课时目录，再选择喜欢的作品。进入搭建前先核对课时的零件与步骤。",
        browseHref: "/courses",
        browseLabel: "查看全部技能课程",
        keywords: ["积木搭建", "积木搭建入门", "少儿积木课程", "大颗粒积木", "结构探索"],
    },
    {
        slug: "scratch",
        label: "Scratch 入门",
        title: "Scratch 少儿编程入门：从角色动作到互动作品",
        description: "了解 Scratch 入门需要的设备与基本概念，从角色、事件和顺序开始，学着运行、检查和修改程序，再做一个能与人互动的小作品。",
        introduction: "Scratch 用可以拖动和连接的图形积木表达程序。入门时，可以先让一个角色完成一个动作，再加入声音、对话或按键响应。每次运行都能看到结果，也能从“和预想不一样”的地方找到下一步要改什么。",
        firstQuestion: "怎样让角色按你的想法行动？",
        firstChallenge: "先让角色在点击开始后移动并说一句话，再把开始方式改为按键。比较两次运行，看看动作为什么会在不同的时刻发生。",
        preparation: [
            "优先准备有鼠标和键盘的电脑，方便拖动积木、输入文字和测试按键；也可以先用移动设备阅读课时步骤。",
            "先认识舞台、角色、积木分类和脚本区，不必一次记住所有积木。选一节入门课，跟着当前步骤找到需要的积木。",
            "给自己的第一个作品写一句目标，例如“按空格让角色打招呼”。先把这个小目标做好，再增加新玩法。",
        ],
        sequence: [
            { title: "认识角色和事件", description: "选中要控制的角色，找到“什么时候开始”的事件积木，再连接一个动作。运行前先猜一猜会发生什么，运行后对照观察。" },
            { title: "把动作排成顺序", description: "让角色依次移动、说话或等待。交换两块积木的位置，看看结果是否变化，从具体作品里理解程序执行的先后顺序。" },
            { title: "用重复和条件丰富作品", description: "当同一段动作需要做很多次时，尝试使用重复；需要根据按键或碰撞作出反应时，再加入条件。一次只增加一种变化，方便定位问题。" },
            { title: "请同伴试玩，再调试", description: "先说清楚作品应该怎样操作，请同伴试一试。遇到角色不动或动作不对时，依次检查选中的角色、触发事件、连接顺序和参数，再次运行验证。" },
        ],
        reflection: ["是哪一块积木让程序开始运行的？", "实际结果和你的预想哪里不同？", "如果换一个角色或按键，需要改哪些地方？"],
        companionNote: "不用替孩子一次排好全部积木。可以请孩子解释某一块积木的作用，陪他把大目标拆成一个个能运行的小动作；调试时，先重现问题再一起找原因。",
        resourceHeading: "选择 Scratch 入门课程",
        resourceIntroduction: "从课程目录里的第一节开始，边读步骤边操作。完成一个小作品后，再尝试改变角色、情节或交互方式。",
        browseHref: "/courses",
        browseLabel: "查看全部技能课程",
        keywords: ["Scratch 入门", "Scratch 少儿编程", "图形化编程", "Scratch 课程", "编程调试"],
    },
    {
        slug: "science",
        label: "科学实验",
        title: "少儿科学实验入门：提出问题、动手验证与记录发现",
        description: "从身边能观察的现象开始，学习科学小实验的准备方法、如何一次改变一个条件、怎样记录和比较结果，并找到可以继续动手的科学项目。",
        introduction: "科学实验从“我想知道为什么”开始。孩子可以围绕纸张、影子、滚动等身边的现象提出问题，先作预测，再动手比较。实验的收获既包括有趣的结果，也包括怎样说明自己的证据、发现还没想清楚的问题。",
        firstQuestion: "一张纸换一种折法，能托住更多东西吗？",
        firstChallenge: "用同样大小的纸、相同的两端间距，分别尝试平放和折起的纸桥。用相同物件逐个增加负载，记录纸桥开始明显弯曲时的情况，再比较两种折法。",
        preparation: [
            "先读具体项目的材料清单和操作要求，从手边熟悉、便于观察的材料开始，确认场地能容纳操作和收拾。",
            "把要研究的问题缩小，例如只比较两种纸张折法。列出要保持一致的条件，以及这次准备改变的一个条件。",
            "准备纸笔记录预测、操作和结果。涉及加热、用电、锋利工具或化学材料的项目，要先由成人确认要求并承担相应操作。",
        ],
        sequence: [
            { title: "从现象提出一个问题", description: "先观察，再把宽泛的“为什么”改成可以比较的问题。例如“哪种纸桥更能承重”，比一下子研究所有桥梁更容易开始。" },
            { title: "先预测，再设计比较", description: "让孩子说出自己的猜想和理由。明确测什么、怎样测，以及哪些条件要保持相同，让两次结果能够放在一起比较。" },
            { title: "边操作边记录", description: "按同样的方法完成各组尝试，记录看见的现象或数量。结果不一致时，再做几次，检查材料、位置或操作方式是否发生了变化。" },
            { title: "用证据解释，再提新问题", description: "把预测与记录放在一起，区分“这次观察到什么”和“我认为为什么”。没有符合预测也可以有收获，再选一个条件继续尝试。" },
        ],
        reflection: ["这次只改变了什么？还有哪些条件可能影响结果？", "换一个人做，能得到相似的结果吗？", "你的记录支持什么判断，又有什么还不能确定？"],
        companionNote: "先听孩子的预测，不急着给标准答案。用“你看到了什么”“怎样再确认一次”帮助孩子把想法和证据连接起来；分工时可以轮流操作、观察和记录。",
        resourceHeading: "继续做一个科学项目",
        resourceIntroduction: "下面是平台近期发布的科学项目。打开详情核对材料、步骤和成人支持要求，再选择适合自己的尝试。",
        browseHref: "/explore?category=%E7%A7%91%E5%AD%A6",
        browseLabel: "探索更多科学项目",
        keywords: ["科学实验", "科学小实验", "少儿科学实践", "实验记录", "项目式学习"],
    },
    {
        slug: "nature",
        label: "自然观察入门",
        title: "自然观察入门：从拍下身边的发现到记录第一次观察",
        description: "从家门口、公园或校园开始，学习拍摄自然观察照片、记录时间地点、面对不确定的物种，并在不打扰自然的前提下留下第一次观察。",
        introduction: "自然观察不必去很远的地方。路边的一棵树、花上的一只昆虫，都可以成为起点。停下来看看，拍下看得清的细节，记住何时、何地发现了它，再慢慢认识身边的生命。",
        firstQuestion: "同一棵树，过几天会有什么变化？",
        firstChallenge: "选择步道旁一棵容易再次找到的树，从安全的位置观察叶片、花或果实。拍下一张清晰照片，记下时间、地点和一句发现。过几天回到同一位置，比较颜色、数量或形态的变化。",
        preparation: [
            "带上能拍照的手机或相机即可开始，也可以准备小本子；先选择熟悉、安全、允许进入的地点，孩子与家长或老师同行。",
            "保持距离，不追赶、不投喂、不翻动巢穴，不为拍照采摘或捕捉，也不要随意触碰陌生生物。让它留在原来的环境里。",
            "公开照片前检查是否拍到人脸、门牌等私人信息；涉及巢穴或敏感物种时，不公开容易使它受到打扰的精确位置。",
        ],
        sequence: [
            { title: "选一个地方，先安静地看", description: "从校园、社区绿地或公园步道开始。先观察它在哪里、在做什么，以及周围的环境，不急着靠近或判断名称。" },
            { title: "拍清主体，也留意特征", description: "在不打扰的距离拍摄，避免逆光和模糊。观察植物的叶、花、果实，或动物的体形、颜色和姿态；能安全拍到多少就记录多少，不必为了细节强行靠近。" },
            { title: "记下真实时间、地点和发现", description: "填写实际看到它的时间与位置，而不是上传时所在的位置。照片中的时间和 GPS 可以辅助填写，但仍需核对。本站上传的每张照片会成为一条独立观察，请分别检查信息。" },
            { title: "不认识也可以先记录", description: "AI 给出的候选是鉴定建议，不是确定答案。对照照片中的特征再选择；拿不准时可以发布为待鉴定，不必为了填写名称而猜一个。审核通过后，社区也可以参与共同鉴定。" },
            { title: "发布以后，再回来看看", description: "提交后留意审核状态和社区建议。回到同一地点继续观察，比较不同时候的变化；记录里把“我看到了什么”和“我猜可能是什么”分开说。" },
        ],
        reflection: ["照片里有哪些支持鉴定的特征？", "还有什么信息不确定，需要再次观察？", "与上一次相比，发生了什么变化？"],
        companionNote: "陪孩子先描述看到的颜色、形状和动作，再一起查找名称。不急着给标准答案，也不以认识多少物种来评判一次观察；认真看见一处变化，就值得记录。",
        resourceHeading: "开始你的第一次观察",
        resourceIntroduction: "先记录真实发现，再逐步认识物种。可以直接记录，也可以先看看图鉴和大家的观察。",
        browseHref: "/nature",
        browseLabel: "返回自然观察",
        keywords: ["自然观察入门", "亲子自然观察", "观察记录", "物种识别", "校园自然"],
    },
];

export function getLearningTopic(slug: string): LearningTopicDefinition | undefined {
    return LEARNING_TOPICS.find((topic) => topic.slug === slug);
}
