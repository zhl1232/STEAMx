# Function Wars v2 美术资源

本目录是游戏运行时使用的最终 WebP 素材。采用内置 `imagegen` 生成，未使用 CLI/API 备用模式。以下保留最终生成提示词，便于后续保持美术一致。

## 接入约束

- 三张背景是无文字、无 UI 的非碰撞远景；由 renderer 按当前主题加载，并保持程序背景降级。前景碰撞轮廓由实际地图绘制。
- 三张炮台统一朝右，左向单位由 renderer 翻转。四张物件保留真实 alpha，不能铺底色或将棋盘格当透明。
- 背景等比导出为 1280×720 WebP（quality 84）。物件裁去透明留白后等比缩到实体宽 448，左右各补 32 透明像素，纵向各补实体高的 1/14（四舍五入），导出 WebP（quality 90，alphaQuality 100）。因此外框宽 512，实体脚底约在高的 0.937 处；炮台炮口约在宽 0.94、高 0.27 处。更新图片时须同步验证 renderer 的标签、脚底与炮口锚点。
- 更换图片不能修改世界坐标、碰撞范围或动画标识。低动态设置由 renderer 控制。

## 最终生成提示词

### grassland-backdrop.webp

```text
Use case: stylized-concept. Asset type: production background plate for a side-view educational artillery game called Function Wars. Create ONE landscape image, aspect ratio 16:9, no text. Art direction: beautifully crafted miniature toy diorama, rounded stylized forms, painted matte surfaces, gentle warm sunlight from upper left, sophisticated friendly game art suitable for ages 11+. Scene: a quiet sunlit meadow valley, pale turquoise sky, soft cream clouds, rounded distant mint hills, a few tiny distant tree groves, warm grassy ridges only in the lower 25 percent. Composition: side-on orthographic panorama, not isometric. Upper 65 percent and broad center must be calm open sky with very low contrast to keep mathematical trajectories readable. All scenery is distant, softened by atmospheric perspective. Soft sage, turquoise, cream and muted golden palette. Attractive crafted material and lighting, not flat vector art. This is BACKGROUND ONLY: no foreground ground/platforms, no floating islands, no boulders, no tanks, no weapons, no characters, no buildings in foreground, no UI, no grid, no symbols, no text, no frame, no watermark. No dramatic sun flare or busy details. Fill the full rectangular image edge to edge; opaque background. Save the generated asset.
```

### canyon-backdrop.webp

```text
Use case: stylized-concept. Asset type: production distant background plate for a side-view educational artillery game. ONE landscape 16:9 image. Same visual family as an exquisite miniature toy diorama: rounded stylized shapes, painted matte surfaces, subtle handcrafted texture, gentle warm sunlight from upper left, polished friendly game art for ages 11+. Scene: quiet terracotta canyon in warm afternoon light, layered coral and ochre mesas far away, pale apricot sky, sparse cream clouds, hazy dusty ridges in lower 30 percent. Side-on orthographic panorama, not isometric. Upper 65 percent and broad center calm open sky, very low contrast for mathematical trajectories. All rock formations distant, small and softened by atmospheric perspective. Muted apricot, sandstone, clay red, cream; elegant shape composition. BACKGROUND ONLY: no foreground cliffs, no ground/platforms, no floating islands, no boulders, no tanks or characters, no weapons, no UI/grid/text/frame/watermark. No hard outlined shapes that could look collidable. No photorealism, no dramatic flares. Fill edge to edge, opaque.
```

### space-backdrop.webp

```text
Use case: stylized-concept. Asset type: production distant background plate for a side-view educational artillery game. ONE landscape 16:9 image. Art direction: an exquisite miniature toy diorama, rounded stylized forms, painted matte surfaces, gentle controlled lighting, polished friendly game art for ages 11+. Scene: calm deep blue orbital vista, a softly illuminated distant blue planet low on the right, tiny distant pale orbital rings, a small far-away satellite silhouette near lower left, a restrained scattering of pinprick stars. Midnight blue, desaturated indigo, soft cyan and muted warm white, not purple neon. Upper 65 percent and center calm dark open space with low contrast so bright mathematical trajectories are readable. Features mostly in lower third or corners, subdued atmospheric haze. Side-on panorama, not isometric. BACKGROUND ONLY: no foreground moon/ground/platforms, no floating rocks, no tanks or characters, no weapons, no UI/grid/text/frame/watermark. Avoid dense stars, nebula clouds, glowing swirls, bright center, lens flares. Fill edge to edge, opaque.
```

### player-turret.webp

```text
Use case: stylized-concept. Asset type: a single transparent game sprite, friendly miniature toy artillery rover for a 2D side-view math game. ONE complete isolated vehicle, no sprite sheet. Art direction: finely made painted matte toy, clean rounded forms, confident readable silhouette, restrained detail, soft upper-left studio light. Teal/turquoise body with cream armor panels, tiny warm amber circular sensor, charcoal rubber treads. Three rounded visible wheels inside one compact continuous tread, a small rounded turret, straight short chunky barrel pointing exactly HORIZONTALLY RIGHT. Strict SIDE ELEVATION (not isometric, no perspective rotation, no visible opposite side), wheels sit on one horizontal baseline. Cannon muzzle is at far right and around upper 35 percent of the vehicle's tight bounding box. Body is squat, charming, mechanical; no human face. Subject centered, full vehicle visible, about 85 percent image width with 8 percent breathing room, width about 1.6 times height. Beautiful clean cutout edges, no colored fringe. Truly transparent alpha background, no checkerboard, no floor, no cast shadow beyond vehicle, no scenery, no text, no logo, no UI. Use a TRANSPARENT background.
```

### enemy.webp

```text
Use case: stylized-concept. Asset type: a single transparent game sprite, opposing miniature toy artillery rover for a 2D side-view math game. ONE complete isolated vehicle, no sprite sheet. Art direction: finely made painted matte toy, clean rounded forms, confident readable silhouette, restrained detail, soft upper-left studio light. Warm coral-red body with ivory armor panels, tiny warm amber circular sensor, charcoal rubber treads. Three rounded visible wheels inside one compact continuous tread, a squat rounded turret with a slightly squared protective cheek, straight short chunky barrel pointing exactly HORIZONTALLY RIGHT. Strict SIDE ELEVATION (not isometric, no perspective rotation, no visible opposite side), wheels sit on one horizontal baseline. Cannon muzzle at far right around upper 35 percent of vehicle's tight bounding box. Charming toy opponent, not scary, no human face. Subject centered, entire vehicle visible, about 85 percent image width with 8 percent breathing room, width about 1.6 times height. Clean cutout edges, no colored fringe. Truly transparent alpha background, no checkerboard, no floor, no cast shadow beyond vehicle, no scenery, no text, logo or UI. Use a TRANSPARENT background.
```

### enemy-armored.webp

```text
Use case: stylized-concept. Asset type: a single transparent game sprite, heavy armored miniature toy artillery rover for a 2D side-view math game. ONE complete isolated vehicle, no sprite sheet. Art direction: finely made painted matte toy, clean chunky rounded forms, readable silhouette, restrained detail, soft upper-left studio light. Slate-blue armor with muted mustard-gold reinforcement plates and warm coral identification panel, charcoal rubber treads. Four visible squat wheels in one continuous tread, low wide reinforced body, broad squat turret with thick bolted armor, chunky short barrel pointing exactly HORIZONTALLY RIGHT. Strict SIDE ELEVATION (not isometric, no perspective rotation, no opposite side), wheels aligned horizontally. Cannon muzzle at far right around upper 35 percent of vehicle's tight bounding box. More robust than a normal rover yet friendly mechanical toy, no human face. Subject centered fully visible, about 85 percent image width with 8 percent breathing room; width about 1.7 times height. Clean cutout edges, no colored fringe. Truly transparent alpha background, no checkerboard, floor, cast shadow beyond vehicle, scenery, text, logo, UI. Use a TRANSPARENT background.
```

### crate.webp

```text
Use case: stylized-concept. Asset type: one transparent supply-crate sprite for a friendly miniature toy artillery game. A compact warm honey-colored wooden supply box with thick rounded corners, pale sage metal corner brackets and one wide ivory cross-shaped reinforcement on its front, a small simple amber latch; no letters or medical symbols. Match polished miniature matte toy art, restrained wood grain, soft light from upper left, clean strong silhouette readable at 24 pixels. Mostly front-facing with just a slight top and right side visible, not strong isometric perspective. Single isolated object centered with 8 percent margin. Genuine transparent alpha background, clean edges with no colored fringe, no floor or cast shadow outside the object, no scenery, text, label, logos, grid, watermark. Not a UI icon tile. Use a TRANSPARENT background.
```
