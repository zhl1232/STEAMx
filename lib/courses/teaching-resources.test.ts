import { expect, test } from 'vitest'
import { lessonTeachingResources } from './teaching-resources'
test('keeps existing internal resources and removes external teaching navigation without changing source data', () => {
 const internal = { title: 'Scratch入门', url: '/learn/scratch' }
 const external = { title: '旧编辑器', url: 'https://scratch.mit.edu/projects/editor/' }
 const data = [internal, external, { title: '协议相对', url: '//example.com' }, { title: '反斜线', url: '/\\example.com' }, { title: '换行', url: '/\n/example.com' }]
 expect(lessonTeachingResources(data)).toEqual([internal])
 expect(data).toContain(external)
 expect(lessonTeachingResources(undefined)).toEqual([])
})
