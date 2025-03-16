import { Tool, ToolExecutionOptions } from 'ai'
import { playAudioTool } from '../play-audio'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as sound from 'sound-play'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('path')
jest.mock('sound-play')

describe('playAudioTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = playAudioTool as Required<Tool>

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>
  const mockPath = path as jest.Mocked<typeof path>
  const mockSound = sound as jest.Mocked<typeof sound>

  // Mock sound play return value
  const mockPlayResult = {
    stdout: Buffer.from(''),
    stdin: Buffer.from(''),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`)
    mockPath.extname.mockImplementation(filePath => {
      const parts = String(filePath).split('.')
      return parts.length > 1 ? `.${parts.pop()}` : ''
    })
  })

  it('should play mp3 file successfully', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockSound.play.mockResolvedValue(mockPlayResult)

    const result = await tool.execute(
      {
        path: 'test.mp3',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Playing audio file: test.mp3')
    expect(mockSound.play).toHaveBeenCalledWith('/mock/path/test.mp3')
  })

  it('should play wav file successfully', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockSound.play.mockResolvedValue(mockPlayResult)

    const result = await tool.execute(
      {
        path: 'test.wav',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Playing audio file: test.wav')
    expect(mockSound.play).toHaveBeenCalledWith('/mock/path/test.wav')
  })

  it('should handle file not found', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'))

    const result = await tool.execute(
      {
        path: 'nonexistent.mp3',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Audio file not found at path: nonexistent.mp3')
    expect(mockSound.play).not.toHaveBeenCalled()
  })

  it('should handle unsupported audio format', async () => {
    mockFs.access.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.midi',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/Unsupported audio format: .midi/)
    expect(result.content[0].text).toMatch(/Supported formats:/)
    expect(mockSound.play).not.toHaveBeenCalled()
  })

  it('should handle playback errors', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockSound.play.mockRejectedValue(new Error('Playback failed'))

    const result = await tool.execute(
      {
        path: 'error.mp3',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error playing audio: Playback failed')
  })

  it('should handle files without extension', async () => {
    mockFs.access.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'audiofile',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/Unsupported audio format:/)
    expect(mockSound.play).not.toHaveBeenCalled()
  })

  it('should support all documented formats', async () => {
    const supportedFormats = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
    mockFs.access.mockResolvedValue(undefined)
    mockSound.play.mockResolvedValue(mockPlayResult)

    for (const format of supportedFormats) {
      const result = await tool.execute(
        {
          path: `test${format}`,
        },
        mockOptions,
      )

      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toBe(`Playing audio file: test${format}`)
      expect(mockSound.play).toHaveBeenCalledWith(`/mock/path/test${format}`)
    }
  })

  it('should handle non-string error messages', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockSound.play.mockRejectedValue({ code: 'PLAYBACK_ERROR' })

    const result = await tool.execute(
      {
        path: 'test.mp3',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error playing audio: [object Object]')
  })
})
