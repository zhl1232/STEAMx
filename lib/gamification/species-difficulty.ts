/**
 * 北京观鸟难易三堆 + 《北京自然观察手册：昆虫》成就名录。
 * 鸟按站内图鉴 slug 分常见 / 进阶 / 稀有；对不上难易表的种按栖息地与居留型归堆。
 * 昆虫八套九宫格与 S 级四项均按中文名对齐站内 slug。
 */

export type BirdDifficulty = "common" | "uncommon" | "rare"
export type InsectHandbookRank = "D" | "C" | "B" | "A" | "S"

export interface NamedSpecies {
    slug: string
    name: string
}

export interface InsectBingoGrid {
    id: string
    rank: Exclude<InsectHandbookRank, "S">
    title: string
    species: readonly NamedSpecies[]
}

export interface InsectChallengeSet {
    id: "stag" | "saturniid" | "carabid" | "mythic"
    title: string
    species: readonly NamedSpecies[]
    mythic?: boolean
}

export const COMMON_BIRD_SLUGS = [
    "pica-pica", // 喜鹊
    "passer-montanus", // 麻雀
    "cyanopica-cyanus", // 灰喜鹊
    "streptopelia-chinensis", // 珠颈斑鸠
    "pycnonotus-sinensis", // 白头鹎
    "hirundo-rustica", // 家燕
    "anas-platyrhynchos", // 绿头鸭
    "nycticorax-nycticorax", // 夜鹭
    "egretta-garzetta", // 白鹭
    "dendrocopos-major", // 大斑啄木鸟
    "tachybaptus-ruficollis", // 小䴙䴘
    "ardea-cinerea", // 苍鹭
    "ardeola-bacchus", // 池鹭
    "gallinula-chloropus", // 黑水鸡
    "fulica-atra", // 白骨顶
    "streptopelia-orientalis", // 山斑鸠
    "anas-poecilorhyncha", // 斑嘴鸭
    "aix-galericulata", // 鸳鸯
    "upupa-epops", // 戴胜
    "alcedo-atthis", // 普通翠鸟
    "parus-major", // 大山雀
    "poecile-palustris", // 沼泽山雀
    "aegithalos-caudatus", // 银喉长尾山雀
    "turdus-merula", // 乌鸫
    "phoenicurus-auroreus", // 北红尾鸲
    "motacilla-alba", // 白鹡鸰
    "chloris-sinica", // 金翅雀
    "acridotheres-cristatellus", // 八哥
    "sturnus-cineraceus", // 灰椋鸟
    "corvus-macrorhynchos", // 大嘴乌鸦
    "corvus-corone", // 小嘴乌鸦
    "urocissa-erythrorhyncha", // 红嘴蓝鹊
    "cecropis-daurica", // 金腰燕
    "cuculus-micropterus", // 四声杜鹃
    "sinosuthora-webbiana", // 棕头鸦雀
    "garrulax-davidi", // 山噪鹛
    "rhopophilus-pekinensis", // 山鹛
    "eophona-migratoria", // 黑尾蜡嘴雀
    "pardaliparus-venustulus", // 黄腹山雀
    "dendrocopos-canicapillus", // 星头啄木鸟
] as const

export const UNCOMMON_BIRD_SLUGS = [
    "accipiter-nisus", // 雀鹰
    "acrocephalus-orientalis", // 东方大苇莺
    "alauda-arvensis", // 云雀
    "anser-anser", // 灰雁
    "anthus-hodgsoni", // 树鹨
    "anthus-spinoletta", // 水鹨
    "apus-apus", // 普通雨燕
    "ardea-alba", // 大白鹭
    "athene-noctua", // 纵纹腹小鸮
    "aythya-ferina", // 红头潜鸭
    "aythya-fuligula", // 凤头潜鸭
    "bombycilla-garrulus", // 太平鸟
    "bombycilla-japonica", // 小太平鸟
    "bucephala-clangula", // 鹊鸭
    "buteo-buteo", // 普通𫛭
    "calliope-calliope", // 红喉歌鸲
    "caprimulgus-indicus", // 普通夜鹰
    "certhiaiaris", // 欧亚旋木雀
    "charadrius-dubius", // 金眶鸻
    "chlidonias-hybrida", // 灰翅浮鸥
    "chroicocephalus-ridibundus", // 红嘴鸥
    "cinclus-pallasii", // 褐河乌
    "corvus-dauuricus", // 达乌里寒鸦
    "coturnix-japonica", // 鹌鹑
    "cuculus-canorus", // 大杜鹃
    "dicrurus-macrocercus", // 黑卷尾
    "emberiza-pusilla", // 小鹀
    "falco-amurensis", // 红脚隼
    "falco-subbuteo", // 燕隼
    "falco-tinnunculus", // 红隼
    "ficedula-albicilla", // 红喉姬鹟
    "ficedula-zanthopygia", // 白眉姬鹟
    "fringilla-montifringilla", // 燕雀
    "gallinago-gallinago", // 扇尾沙锥
    "halcyon-pileata", // 蓝翡翠
    "himantopus-himantopus", // 黑翅长脚鹬
    "ixobrychus-sinensis", // 黄斑苇鳽
    "jynx-torquilla", // 蚁䴕
    "lanius-cristatus", // 红尾伯劳
    "lanius-sphenocercus", // 楔尾伯劳
    "larvivora-cyane", // 蓝歌鸲
    "luscinia-svecica", // 蓝喉歌鸲
    "mergellus-albellus", // 斑头秋沙鸭
    "mergus-merganser", // 普通秋沙鸭
    "milvus-migrans", // 黑鸢
    "muscapa-sibirica", // 乌鹟
    "muscicapa-griseisticta", // 灰纹鹟
    "netta-rufina", // 赤嘴潜鸭
    "oriolus-chinensis", // 黑枕黄鹂
    "phalacrocorax-carbo", // 普通鸬鹚
    "phasianus-colchicus", // 环颈雉
    "phylloscopus-inornatus", // 黄腰柳莺
    "picus-canus", // 灰头绿啄木鸟
    "podiceps-cristatus", // 凤头䴙䴘
    "regulus-regulus", // 戴菊
    "rhyacornis-fuliginosus", // 红尾水鸲
    "saxicola-torquata", // 黑喉石䳭
    "sitta-villosa", // 黑头䴓
    "spinus-spinus", // 黄雀
    "tadorna-ferruginea", // 赤麻鸭
    "tarsiger-cyanurus", // 红胁蓝尾鸲
    "terpsiphone-incei", // 寿带
    "troglodytes-troglodytes", // 鹪鹩
    "turdus-eunomus", // 斑鸫
    "turdus-naumanni", // 红尾鸫
    "turdus-ruficollis", // 赤颈鸫
    "vanellus-vanellus", // 凤头麦鸡
    "zoothera-dauma", // 虎斑地鸫
    "zosterops-erythropleurus", // 红胁绣眼鸟
] as const

export const RARE_BIRD_SLUGS = [
    "crossoptilon-mantchuricum", // 褐马鸡
    "otis-tarda", // 大鸨
    "aquila-chrysaetos", // 金雕
    "aegypius-monachus", // 秃鹫
    "haliaeetus-albicilla", // 白尾海雕
    "ciconia-nigra", // 黑鹳
    "grus-grus", // 灰鹤
    "bubo-bubo", // 雕鸮
    "cygnus-cygnus", // 大天鹅
    "cygnus-columbianus", // 小天鹅
    "pandion-haliaetus", // 鹗
    "falco-peregrinus", // 游隼
    "pernis-ptilorhynchus", // 凤头蜂鹰
    "circus-cyaneus", // 白尾鹞
    "strix-aluco", // 灰林鸮
    "asio-flammeus", // 短耳鸮
    "asio-otus", // 长耳鸮
    "otus-sunia", // 红角鸮
    "ninox-japonica", // 日本鹰鸮
    "anser-cygnoides", // 鸿雁
    "sibirionetta-formosa", // 花脸鸭
    "megaceryle-lugubris", // 冠鱼狗
    "melanocorypha-mongolica", // 蒙古百灵
    "botaurus-stellaris", // 大麻鳽
] as const

const BIRD_DIFFICULTY_BY_SLUG = new Map<string, BirdDifficulty>([
    ["pica-pica", "common"],
    ["passer-montanus", "common"],
    ["cyanopica-cyanus", "common"],
    ["streptopelia-chinensis", "common"],
    ["pycnonotus-sinensis", "common"],
    ["hirundo-rustica", "common"],
    ["anas-platyrhynchos", "common"],
    ["nycticorax-nycticorax", "common"],
    ["egretta-garzetta", "common"],
    ["dendrocopos-major", "common"],
    ["tachybaptus-ruficollis", "common"],
    ["ardea-cinerea", "common"],
    ["ardeola-bacchus", "common"],
    ["gallinula-chloropus", "common"],
    ["fulica-atra", "common"],
    ["streptopelia-orientalis", "common"],
    ["anas-poecilorhyncha", "common"],
    ["aix-galericulata", "common"],
    ["upupa-epops", "common"],
    ["alcedo-atthis", "common"],
    ["parus-major", "common"],
    ["poecile-palustris", "common"],
    ["aegithalos-caudatus", "common"],
    ["turdus-merula", "common"],
    ["phoenicurus-auroreus", "common"],
    ["motacilla-alba", "common"],
    ["chloris-sinica", "common"],
    ["acridotheres-cristatellus", "common"],
    ["sturnus-cineraceus", "common"],
    ["corvus-macrorhynchos", "common"],
    ["corvus-corone", "common"],
    ["urocissa-erythrorhyncha", "common"],
    ["cecropis-daurica", "common"],
    ["cuculus-micropterus", "common"],
    ["sinosuthora-webbiana", "common"],
    ["garrulax-davidi", "common"],
    ["rhopophilus-pekinensis", "common"],
    ["eophona-migratoria", "common"],
    ["pardaliparus-venustulus", "common"],
    ["dendrocopos-canicapillus", "common"],
    ["accipiter-nisus", "uncommon"],
    ["acrocephalus-orientalis", "uncommon"],
    ["alauda-arvensis", "uncommon"],
    ["anser-anser", "uncommon"],
    ["anthus-hodgsoni", "uncommon"],
    ["anthus-spinoletta", "uncommon"],
    ["apus-apus", "uncommon"],
    ["ardea-alba", "uncommon"],
    ["athene-noctua", "uncommon"],
    ["aythya-ferina", "uncommon"],
    ["aythya-fuligula", "uncommon"],
    ["bombycilla-garrulus", "uncommon"],
    ["bombycilla-japonica", "uncommon"],
    ["bucephala-clangula", "uncommon"],
    ["buteo-buteo", "uncommon"],
    ["calliope-calliope", "uncommon"],
    ["caprimulgus-indicus", "uncommon"],
    ["certhiaiaris", "uncommon"],
    ["charadrius-dubius", "uncommon"],
    ["chlidonias-hybrida", "uncommon"],
    ["chroicocephalus-ridibundus", "uncommon"],
    ["cinclus-pallasii", "uncommon"],
    ["corvus-dauuricus", "uncommon"],
    ["coturnix-japonica", "uncommon"],
    ["cuculus-canorus", "uncommon"],
    ["dicrurus-macrocercus", "uncommon"],
    ["emberiza-pusilla", "uncommon"],
    ["falco-amurensis", "uncommon"],
    ["falco-subbuteo", "uncommon"],
    ["falco-tinnunculus", "uncommon"],
    ["ficedula-albicilla", "uncommon"],
    ["ficedula-zanthopygia", "uncommon"],
    ["fringilla-montifringilla", "uncommon"],
    ["gallinago-gallinago", "uncommon"],
    ["halcyon-pileata", "uncommon"],
    ["himantopus-himantopus", "uncommon"],
    ["ixobrychus-sinensis", "uncommon"],
    ["jynx-torquilla", "uncommon"],
    ["lanius-cristatus", "uncommon"],
    ["lanius-sphenocercus", "uncommon"],
    ["larvivora-cyane", "uncommon"],
    ["luscinia-svecica", "uncommon"],
    ["mergellus-albellus", "uncommon"],
    ["mergus-merganser", "uncommon"],
    ["milvus-migrans", "uncommon"],
    ["muscapa-sibirica", "uncommon"],
    ["muscicapa-griseisticta", "uncommon"],
    ["netta-rufina", "uncommon"],
    ["oriolus-chinensis", "uncommon"],
    ["phalacrocorax-carbo", "uncommon"],
    ["phasianus-colchicus", "uncommon"],
    ["phylloscopus-inornatus", "uncommon"],
    ["picus-canus", "uncommon"],
    ["podiceps-cristatus", "uncommon"],
    ["regulus-regulus", "uncommon"],
    ["rhyacornis-fuliginosus", "uncommon"],
    ["saxicola-torquata", "uncommon"],
    ["sitta-villosa", "uncommon"],
    ["spinus-spinus", "uncommon"],
    ["tadorna-ferruginea", "uncommon"],
    ["tarsiger-cyanurus", "uncommon"],
    ["terpsiphone-incei", "uncommon"],
    ["troglodytes-troglodytes", "uncommon"],
    ["turdus-eunomus", "uncommon"],
    ["turdus-naumanni", "uncommon"],
    ["turdus-ruficollis", "uncommon"],
    ["vanellus-vanellus", "uncommon"],
    ["zoothera-dauma", "uncommon"],
    ["zosterops-erythropleurus", "uncommon"],
    ["crossoptilon-mantchuricum", "rare"],
    ["otis-tarda", "rare"],
    ["aquila-chrysaetos", "rare"],
    ["aegypius-monachus", "rare"],
    ["haliaeetus-albicilla", "rare"],
    ["ciconia-nigra", "rare"],
    ["grus-grus", "rare"],
    ["bubo-bubo", "rare"],
    ["cygnus-cygnus", "rare"],
    ["cygnus-columbianus", "rare"],
    ["pandion-haliaetus", "rare"],
    ["falco-peregrinus", "rare"],
    ["pernis-ptilorhynchus", "rare"],
    ["circus-cyaneus", "rare"],
    ["strix-aluco", "rare"],
    ["asio-flammeus", "rare"],
    ["asio-otus", "rare"],
    ["otus-sunia", "rare"],
    ["ninox-japonica", "rare"],
    ["anser-cygnoides", "rare"],
    ["sibirionetta-formosa", "rare"],
    ["megaceryle-lugubris", "rare"],
    ["melanocorypha-mongolica", "rare"],
    ["botaurus-stellaris", "rare"],
])

/** 早期种子用过英文 slug，和学名 slug 视为同一种。 */
const BIRD_SLUG_ALIASES: Record<string, string> = {
    mallard: "anas-platyrhynchos",
    "black-crowned-night-heron": "nycticorax-nycticorax",
    "little-egret": "egretta-garzetta",
    "little-grebe": "tachybaptus-ruficollis",
    "grey-heron": "ardea-cinerea",
    "great-egret": "ardea-alba",
    "great-cormorant": "phalacrocorax-carbo",
}

export function getBirdDifficulty(slug: string): BirdDifficulty | null {
    const canonical = BIRD_SLUG_ALIASES[slug] ?? slug
    return BIRD_DIFFICULTY_BY_SLUG.get(canonical) ?? null
}

export function countBirdsByDifficulty(slugs: Iterable<string>) {
    let commonCount = 0
    let uncommonCount = 0
    let rareCount = 0
    const seen = new Set<string>()
    for (const slug of slugs) {
        if (seen.has(slug)) continue
        seen.add(slug)
        const difficulty = getBirdDifficulty(slug)
        if (difficulty === "common") commonCount += 1
        else if (difficulty === "uncommon") uncommonCount += 1
        else if (difficulty === "rare") rareCount += 1
    }
    return { common: commonCount, uncommon: uncommonCount, rare: rareCount }
}

export const INSECT_BINGO_GRIDS: readonly InsectBingoGrid[] = [
    {
        id: "d_urban",
        rank: "D",
        title: "城区路边",
        species: [
        { slug: "lycorma-delicatula", name: "斑衣蜡蝉" },
        { slug: "eucryptorrhynchus-scrobiculatus", name: "沟眶象" },
        { slug: "eucryptorrhynchus-brandti", name: "臭椿沟眶象" },
        { slug: "pieris-rapae", name: "菜粉蝶" },
        { slug: "cryptotympana-atrata", name: "黑蚱蝉" },
        { slug: "meimuna-mongolica", name: "蒙古寒蝉" },
        { slug: "coccinella-septempunctata", name: "七星瓢虫" },
        { slug: "harmonia-axyridis", name: "异色瓢虫" },
        { slug: "macroglossum-stellatarum", name: "小豆长喙天蛾" },
    ],
    },
    {
        id: "d_odonata",
        rank: "D",
        title: "城区公园蜻蜓",
        species: [
        { slug: "pantala-flavescens", name: "黄蜻" },
        { slug: "crocothemis-servilia", name: "红蜻" },
        { slug: "pseudothemis-zonata", name: "玉带蜻" },
        { slug: "deielia-phaon", name: "异色多纹蜻" },
        { slug: "orthetrum-albistylum", name: "白尾灰蜻" },
        { slug: "anax-parthenope-julius", name: "碧伟蜓" },
        { slug: "ischnura-elegans", name: "长叶异痣蟌" },
        { slug: "paracercion-calamorum", name: "蓝纹尾蟌" },
        { slug: "platycnemis-phyllopoda", name: "叶足扇蟌" },
    ],
    },
    {
        id: "c_mountain",
        rank: "C",
        title: "山区常见",
        species: [
        { slug: "acrida-cinerea", name: "中华剑角蝗" },
        { slug: "atractomorpha-sinensis", name: "短额负蝗" },
        { slug: "hierodula-patellifera", name: "广斧螳" },
        { slug: "tenodera-sinensis", name: "中华大刀螳" },
        { slug: "camponotus-japonicus", name: "日本弓背蚁" },
        { slug: "hyalessa-maculaticollis", name: "鸣鸣蝉" },
        { slug: "platypleura-kaempferi", name: "蟪蛄" },
        { slug: "aromia-bungii", name: "桃红颈天牛" },
        { slug: "papilio-xuthus", name: "花椒凤蝶" },
    ],
    },
    {
        id: "c_butterflies",
        rank: "C",
        title: "常见蝴蝶",
        species: [
        { slug: "pieris-rapae", name: "菜粉蝶" },
        { slug: "pontia-daplidice", name: "云粉蝶" },
        { slug: "papilio-xuthus", name: "花椒凤蝶" },
        { slug: "sericinus-montelus", name: "丝带凤蝶" },
        { slug: "papilio-maackii", name: "绿带翠凤蝶" },
        { slug: "vanessa-indica", name: "大红蛱蝶" },
        { slug: "vanessa-cardui", name: "小红蛱蝶" },
        { slug: "polygonia-c-aureum", name: "黄钩蛱蝶" },
        { slug: "everes-argiades", name: "蓝灰蝶" },
    ],
    },
    {
        id: "b_urban",
        rank: "B",
        title: "城区进阶",
        species: [
        { slug: "pontia-daplidice", name: "云粉蝶" },
        { slug: "papilio-xuthus", name: "花椒凤蝶" },
        { slug: "hierodula-patellifera", name: "广斧螳" },
        { slug: "polyphaga-plancyi", name: "冀地鳖" },
        { slug: "velarifictorus-micado", name: "中华斗蟋" },
        { slug: "loxoblemmus-doenitzi", name: "多伊棺头蟋" },
        { slug: "erthesina-fullo", name: "麻皮蝽" },
        { slug: "anoplophora-glabripennis", name: "光肩星天牛" },
        { slug: "chrysochus-chinensis", name: "中华萝藦肖叶甲" },
    ],
    },
    {
        id: "b_light",
        rank: "B",
        title: "山区灯诱",
        species: [
        { slug: "actias-selene", name: "绿尾大蚕蛾" },
        { slug: "samia-cynthia", name: "樗蚕" },
        { slug: "dorcus-rubrofemoratus", name: "红腿刀锹" },
        { slug: "dorcus-davidis", name: "大卫大锹" },
        { slug: "prismognathus-davidis", name: "大卫鬼锹" },
        { slug: "forficula-davidi", name: "达球螋" },
        { slug: "eumantispa-harmandi", name: "汉优螳蛉" },
        { slug: "protohermes-xanthodes", name: "炎黄星齿蛉" },
        { slug: "acanthacorydalis-orientalis", name: "东方巨齿蛉" },
    ],
    },
    {
        id: "a_mountain",
        rank: "A",
        title: "山区进阶",
        species: [
        { slug: "parnassius-bremeri", name: "红珠绢蝶" },
        { slug: "melanargia-halimede", name: "白眼蝶" },
        { slug: "papilio-maackii", name: "绿带翠凤蝶" },
        { slug: "kaniska-canace", name: "琉璃蛱蝶" },
        { slug: "prosopocoilus-astacoides", name: "两点锯锹" },
        { slug: "carabus-smaragdinus", name: "绿步甲" },
        { slug: "elimaea-fallax", name: "秋掩耳螽" },
        { slug: "cnizocoris-sinensis", name: "中国螳瘤蝽" },
        { slug: "haplotropis-brunneriana", name: "笨蝗" },
    ],
    },
    {
        id: "a_odonata",
        rank: "A",
        title: "山区蜻蜓",
        species: [
        { slug: "gomphidia-confluens", name: "联纹小叶春蜓" },
        { slug: "sieboldius-albardae", name: "艾氏施春蜓" },
        { slug: "anisogomphus-maacki", name: "马奇异春蜓" },
        { slug: "anax-nigrofasciatus", name: "黑纹伟蜓" },
        { slug: "sympetrum-eroticum", name: "竖眉赤蜻" },
        { slug: "sympetrum-striolatum", name: "条斑赤蜻" },
        { slug: "orthetrum-lineostigma", name: "线痣灰蜻" },
        { slug: "matrona-basilaris", name: "透顶单脉色蟌" },
        { slug: "platycnemis-foliacea", name: "白扇蟌" },
    ],
    },
]

export const INSECT_S_CHALLENGES: readonly InsectChallengeSet[] = [
    {
        id: "stag",
        title: "锹甲",
        species: [
        { slug: "prosopocoilus-astacoides", name: "两点锯锹" },
        { slug: "prismognathus-davidis", name: "大卫鬼锹" },
        { slug: "dorcus-davidis", name: "大卫大锹" },
        { slug: "dorcus-rubrofemoratus", name: "红腿刀锹" },
        { slug: "falcicornis-tenuecostatus", name: "皮氏小刀锹" },
        { slug: "dorcus-tenuihirsutus", name: "北方锈刀锹" },
        { slug: "serrognathus-consentaneus", name: "尖腹扁锹" },
        { slug: "lucanus-dybowski", name: "斑股深山锹" },
    ],
    },
    {
        id: "saturniid",
        title: "大蚕蛾",
        species: [
        { slug: "samia-cynthia", name: "樗蚕" },
        { slug: "actias-selene", name: "绿尾大蚕蛾" },
        { slug: "actias-dubernardi", name: "长尾大蚕蛾" },
        { slug: "saturnia-boisduvali", name: "合目大蚕蛾" },
        { slug: "saturnia-thibeta", name: "闭目大蚕蛾" },
        { slug: "saturnia-pyretorum", name: "樟蚕" },
        { slug: "loepa-wlingana", name: "雾灵豹蚕蛾" },
        { slug: "aglia-tau", name: "丁目大蚕蛾" },
    ],
    },
    {
        id: "carabid",
        title: "大步甲",
        species: [
        { slug: "carabus-smaragdinus", name: "绿步甲" },
        { slug: "carabus-brandti", name: "麻步甲" },
        { slug: "carabus-manifestus", name: "罕丽步甲" },
        { slug: "carabus-crassesculptus", name: "碎纹粗皱步甲" },
        { slug: "carabus-vladimirskyi", name: "长叶步甲" },
        { slug: "carabus-granulatus", name: "粒步甲" },
        { slug: "carabus-canaliculatus", name: "沟步甲" },
        { slug: "carabus-sculptipennis", name: "刻翅步甲" },
        { slug: "carabus-hummeli", name: "肩步甲" },
    ],
    },
    {
        id: "mythic",
        title: "北京神物",
        species: [
        { slug: "asiagomphus-hesperius", name: "西南亚春蜓" },
        { slug: "tenomerga-anguliscutis", name: "普通叉长扁甲" },
        { slug: "platyrhopalus-paussoides", name: "五斑棒角甲" },
        { slug: "falcicornis-tenuecostatus", name: "皮氏小刀锹" },
        { slug: "cucujus-haematodes", name: "血红扁甲" },
        { slug: "bittacus-planus", name: "扁蚊蝎蛉" },
        { slug: "osmoderma-barnabita", name: "凹背臭斑金龟" },
    ],
        mythic: true,
    },
]

export const MYTHIC_INSECT_SLUGS = INSECT_S_CHALLENGES.find((item) => item.id === "mythic")!.species.map((item) => item.slug)

export function isGridComplete(grid: InsectBingoGrid, observed: Set<string>) {
    return grid.species.every((item) => observed.has(item.slug))
}

export function isChallengeComplete(challenge: InsectChallengeSet, observed: Set<string>) {
    return challenge.species.every((item) => observed.has(item.slug))
}

export function getCompletedInsectRanks(observed: Set<string>): InsectHandbookRank[] {
    const ranks: InsectHandbookRank[] = []
    for (const rank of ["D", "C", "B", "A"] as const) {
        const complete = INSECT_BINGO_GRIDS.some((grid) => grid.rank === rank && isGridComplete(grid, observed))
        if (complete) ranks.push(rank)
    }
    if (INSECT_S_CHALLENGES.some((challenge) => isChallengeComplete(challenge, observed))) {
        ranks.push("S")
    }
    return ranks
}

/** 0 = 未入门，1=D … 5=S。取已完成的最高一级，供阶梯徽章 getValue 使用。 */
export function getInsectRankLevel(observed: Set<string>): number {
    const ranks = getCompletedInsectRanks(observed)
    if (ranks.includes("S")) return 5
    if (ranks.includes("A")) return 4
    if (ranks.includes("B")) return 3
    if (ranks.includes("C")) return 2
    if (ranks.includes("D")) return 1
    return 0
}

export interface InsectGridProgress {
    id: string
    rank: Exclude<InsectHandbookRank, "S">
    title: string
    found: number
    total: number
    complete: boolean
    cells: Array<NamedSpecies & { found: boolean }>
}

export interface InsectChallengeProgress {
    id: InsectChallengeSet["id"]
    title: string
    found: number
    total: number
    complete: boolean
    mythic: boolean
    cells: Array<NamedSpecies & { found: boolean }>
}

export interface InsectObservationProgress {
    rankLevel: number
    completedRanks: InsectHandbookRank[]
    grids: InsectGridProgress[]
    challenges: InsectChallengeProgress[]
    mythicObservedCount: number
    mythicRevealed: boolean
    diamondUnlocked: boolean
}

const INSECT_CATALOG_SLUGS = new Set<string>([
    ...INSECT_BINGO_GRIDS.flatMap((grid) => grid.species.map((item) => item.slug)),
    ...INSECT_S_CHALLENGES.flatMap((challenge) => challenge.species.map((item) => item.slug)),
])

export function buildNatureBadgeStats(observed: Array<{ slug: string; natureTopic?: string | null }>) {
    const slugs = observed.map((item) => item.slug)
    const birdCounts = countBirdsByDifficulty(slugs)
    const insectSlugs = observed
        .filter((item) => item.natureTopic === "insects" || INSECT_CATALOG_SLUGS.has(item.slug))
        .map((item) => item.slug)
    const insectProgress = buildInsectObservationProgress(insectSlugs)
    return {
        commonBirdsObserved: birdCounts.common,
        uncommonBirdsObserved: birdCounts.uncommon,
        rareBirdsObserved: birdCounts.rare,
        insectRank: insectProgress.rankLevel,
        observedInsectSlugs: [...new Set(insectSlugs)],
        mythicInsectsObserved: insectProgress.mythicObservedCount,
        insectProgress,
    }
}

export function buildInsectObservationProgress(observedSlugs: Iterable<string>): InsectObservationProgress {
    const observed = observedSlugs instanceof Set ? observedSlugs : new Set(observedSlugs)
    const grids = INSECT_BINGO_GRIDS.map((grid) => {
        const cells = grid.species.map((item) => ({ ...item, found: observed.has(item.slug) }))
        const found = cells.filter((cell) => cell.found).length
        return {
            id: grid.id,
            rank: grid.rank,
            title: grid.title,
            found,
            total: grid.species.length,
            complete: found === grid.species.length,
            cells,
        }
    })
    const challenges = INSECT_S_CHALLENGES.map((challenge) => {
        const cells = challenge.species.map((item) => ({ ...item, found: observed.has(item.slug) }))
        const found = cells.filter((cell) => cell.found).length
        return {
            id: challenge.id,
            title: challenge.title,
            found,
            total: challenge.species.length,
            complete: found === challenge.species.length,
            mythic: challenge.mythic === true,
            cells,
        }
    })
    const mythic = challenges.find((item) => item.id === "mythic")!
    const diamondUnlocked = challenges.some((item) => item.complete)
    const mythicObservedCount = mythic.found
    return {
        rankLevel: getInsectRankLevel(observed),
        completedRanks: getCompletedInsectRanks(observed),
        grids,
        challenges,
        mythicObservedCount,
        mythicRevealed: mythicObservedCount > 0 || mythic.complete,
        diamondUnlocked,
    }
}

