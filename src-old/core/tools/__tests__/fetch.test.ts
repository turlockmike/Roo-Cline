import { Tool, ToolExecutionOptions } from 'ai'
import { fetchTool } from '../fetch'

// Mock global fetch
const originalFetch = global.fetch

describe('fetchTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = fetchTool as Required<Tool>

  beforeEach(() => {
    // Reset fetch mock
    global.fetch = jest.fn()
  })

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch
  })

  it('should fetch text content successfully', async () => {
    const mockResponse = new Response('Sample text content', {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/text',
        format: 'text',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Sample text content')
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/text', { headers: {} })
  })

  it('should fetch and parse JSON content', async () => {
    const mockData = { key: 'value', nested: { item: 123 } }
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/json',
        format: 'json',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(JSON.stringify(mockData, null, 2))
  })

  it('should fetch HTML content', async () => {
    const htmlContent = '<html><body>Test content</body></html>'
    const mockResponse = new Response(htmlContent, {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/html',
        format: 'html',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(htmlContent)
  })

  it('should handle custom headers', async () => {
    const mockResponse = new Response('Content with custom headers', {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const customHeaders = {
      Authorization: 'Bearer token123',
      'Custom-Header': 'custom-value',
    }

    await tool.execute(
      {
        url: 'https://example.com/api',
        headers: JSON.stringify(customHeaders),
      },
      mockOptions,
    )

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/api', {
      headers: customHeaders,
    })
  })

  it('should handle HTTP error responses', async () => {
    const mockResponse = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/not-found',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('HTTP error 404: Not Found')
  })

  it('should handle network errors', async () => {
    const networkError = new Error('Network error')
    ;(global.fetch as jest.Mock).mockRejectedValue(networkError)

    const result = await tool.execute(
      {
        url: 'https://example.com/error',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error fetching URL: Network error')
  })

  it('should handle invalid JSON responses', async () => {
    const mockResponse = new Response('invalid json', {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/invalid-json',
        format: 'json',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/Error fetching URL:/)
  })

  it('should default to text format when not specified', async () => {
    const mockResponse = new Response('Default text content', {
      status: 200,
      statusText: 'OK',
    })

    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const result = await tool.execute(
      {
        url: 'https://example.com/default',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Default text content')
  })
})
