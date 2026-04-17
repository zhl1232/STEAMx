/**
 * 批量优化项目数据：文案、步骤、难度评级
 * 
 * 用法: OPENAI_API_KEY=xxx node scripts/optimize-projects.mjs
 * 
 * 输出: /tmp/optimized_projects.json
 */

import fs from 'fs';

const SUPA_URL = 'https://spb-l3q6k3bebzxrok83.supabase.opentrust.net';
const SUPA_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNwYi1sM3E2azNiZWJ6eHJvazgzIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMDAzOTEsImV4cCI6MjA4NzY3NjM5MX0.z_4MutrF9cA9JPMvIYAsyrWKG3pfAivFsUMjPLaS1IQ';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OUTPUT_FILE = '/tmp/optimized_projects.json';
const PROGRESS_FILE = '/tmp/optimize_progress.json';
const CONCURRENCY = 5;

if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const SYSTEM_PROMPT = `你是一个 STEAM 教育项目的内容编辑。你的任务是优化项目的文案和内容质量。

## 优化规则

### 1. 文案口吻
- 把所有"孩子将""参与者将""小朋友将""孩子们"改为面向用户的第二人称"你"
- 语气从教案式改为产品引导式，像是在对做项目的人说话
- 保持简洁有趣，不要说教

### 2. 难度星级重新评定 (1-5星)
根据以下标准重新打分：
- 1星：5分钟内完成，无需工具，纯手工折叠/拼贴
- 2星：15-30分钟，需要剪刀胶水等基础工具
- 3星：30-60分钟，需要特定材料或简单工具配合
- 4星：1小时以上，需要多步骤配合或一定技巧
- 5星：复杂项目，需要专业工具/知识/多次尝试

### 3. 步骤优化
- 每个步骤必须是具体可执行的动作，不能是"学习XX""了解XX""讨论XX"
- 如果最后一步是纯讨论/总结/原理学习，改写成可操作的验证/测试步骤，或删掉
- 步骤要具体到：做什么、怎么做、做到什么程度
- 如果某个步骤无法用文字描述清楚（比如复杂折纸），标记 cannotReproduce: true

### 4. 判断是否建议删除
如果项目满足以下任一条件，设 shouldDelete: true：
- 步骤完全无法通过文字复现（需要视频演示）
- 项目本质是"阅读/学习/写报告"而非动手制作
- 项目与其他项目高度重复（仅凭单个项目无法判断，跳过此条）

## 输出格式
严格输出 JSON，不要输出其他内容：
{
  "description": "优化后的描述",
  "difficulty_stars": 数字1-5,
  "steps": [
    { "sort_order": 1, "title": "步骤标题", "description": "具体操作描述" }
  ],
  "shouldDelete": false,
  "deleteReason": "",
  "changes": "简述做了哪些修改"
}`;

async function fetchAllProjects() {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/projects?select=id,title,category,difficulty_stars,description,status,sub_categories(name),project_materials(material,sort_order),project_steps(title,description,sort_order)&status=eq.approved&order=id&limit=500`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
  );
  return res.json();
}

async function optimizeProject(project) {
  const sub = project.sub_categories?.name || '?';
  const materials = (project.project_materials || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(m => m.material);
  const steps = (project.project_steps || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(s => ({ sort_order: s.sort_order, title: s.title, description: s.description }));

  const userPrompt = `请优化以下项目：

标题: ${project.title}
分类: ${project.category} > ${sub}
当前难度: ${project.difficulty_stars}星
描述: ${project.description}
材料: ${materials.join('、')}
步骤:
${steps.map(s => `${s.sort_order}. [${s.title}] ${s.description}`).join('\n')}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

async function processWithRetry(project, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await optimizeProject(project);
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`  Retry ${i + 1} for [${project.id}] ${project.title}: ${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function main() {
  console.log('Fetching projects from Supabase...');
  const projects = await fetchAllProjects();
  console.log(`Got ${projects.length} projects`);

  // Load progress
  let results = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    results = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`Resuming: ${Object.keys(results).length} already done`);
  }

  const todo = projects.filter(p => !results[p.id]);
  console.log(`To process: ${todo.length}`);

  let done = 0;
  const total = todo.length;

  // Process in batches
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (project) => {
      try {
        const optimized = await processWithRetry(project);
        results[project.id] = {
          id: project.id,
          title: project.title,
          category: project.category,
          sub_category: project.sub_categories?.name,
          original_stars: project.difficulty_stars,
          ...optimized,
        };
        done++;
        const pct = ((done / total) * 100).toFixed(1);
        console.log(`[${done}/${total} ${pct}%] ✓ [${project.id}] ${project.title} (${project.difficulty_stars}⭐→${optimized.difficulty_stars}⭐)`);
      } catch (err) {
        console.error(`[${project.id}] ${project.title} FAILED: ${err.message}`);
        results[project.id] = { id: project.id, title: project.title, error: err.message };
      }
    });
    await Promise.all(promises);

    // Save progress after each batch
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(results, null, 2));
  }

  // Save final output
  const output = projects.map(p => results[p.id]).filter(Boolean);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  const stats = {
    total: output.length,
    shouldDelete: output.filter(r => r.shouldDelete).length,
    starsChanged: output.filter(r => r.original_stars !== r.difficulty_stars).length,
    errors: output.filter(r => r.error).length,
  };
  console.log('\n=== Done ===');
  console.log(`Total: ${stats.total}`);
  console.log(`Stars changed: ${stats.starsChanged}`);
  console.log(`Should delete: ${stats.shouldDelete}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
