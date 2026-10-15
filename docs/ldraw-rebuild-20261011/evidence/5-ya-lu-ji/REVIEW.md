# 压路机源图重建草稿

8源页实际逐页查看，7搭建阶段；49件，零省略。SHA 41c0a7ea916fcfa0ef663dc965bfc9e0459f8a1946a46c608a421e0bf1c3b943。

- P1 blue half shafts meet atZ0; no keyed coupler in source. Native6523 gear collars atZ+-60 sit just inside axle bricksZ80..160; wheel centers+-180. Seam/retention are not physical validation.
- P3 yellow lower layer and red front axle layer match source count; hidden lower brick seams inferred within source rectangular block.
- P4 31196c01/6345 are existing user-approved local approximate geometry, not official exact cab. Cream19 opaque material follows source appearance; colour exactness unverified. Cab rear deck top assumedY-256 supports frame bottom atY-256; roof bottomY-400 on frame top, front roof overhang unsupported in source. Cab/hood/frame interfaces retain mesh risk.
- 61649+90265 selected from known inventory and source four-pane red frame. Pane uses frame-relative(65.5,72,-40) transformed with proper matrix; frame rear-facing (+X), white window faces rear.
- P5 arm end hole spacing400LDU, body pivot(-80,-184) and drum(-472.713..., -108) give76LDU fall. Source approximate downward pose adjusted to keep red wheels near ground0 and large roller on board top-4; no scaling.
- P6 four large gears40LDU thick fill160LDU drum width; arm inner facesZ+-80 meet drum outer faces. Native hubs/tooth clearances and dynamic rotation not certified.
- P7 source ten loose obstacle bricks and24x24 baseplate are retained. Exact irregular positions not fixed by schematic; current stud-grid arrangement is a documented scene-layout adjustment. Actual4268base is4LDU thick, not metadata24; source road wheel vehicle outside board, front roller over board.

等待主线程渲染实际复核，未验收。

原检查 exit 2，2 个准确行号报警对；原文保存在collision.txt，逐对解释在static-alarm-review.json。矩阵最大正交误差 6.228718651968279e-10，无缩放/反射。库存差额见current-bom-evidence.json，不能据参考套装断言用户实物库存。

当前final3及7累计步骤已实际像素复核，原step4/6与源p8补查。全帧未见裁切。两项近似舱接口风险保留；当前记录current-pixel-review.json，非实体或用户验收。
