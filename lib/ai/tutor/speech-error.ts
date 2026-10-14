export class TutorSpeechError extends Error {
  constructor(message: string, public userMessage = '小迪语音暂时不可用，请稍后再试。', public status = 500) {
    super(message)
    this.name = 'TutorSpeechError'
  }
}
