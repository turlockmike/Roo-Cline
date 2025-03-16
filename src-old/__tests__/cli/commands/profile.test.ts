import { jest } from '@jest/globals'
import { Command } from 'commander'
import { confirm } from '@inquirer/prompts'
import { ProfileManager } from '../../../config/profile-manager'
import { registerProfileCommands } from '../../../cli/commands/profile'

jest.mock('@inquirer/prompts')
jest.mock('../../../config/profile-manager')

describe('profile commands', () => {
  let program: Command
  let mockDeleteProfile: jest.Mock
  const mockConfirm = confirm as jest.MockedFunction<typeof confirm>
  const mockProfileManager = ProfileManager as jest.MockedClass<typeof ProfileManager>
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  beforeEach(() => {
    program = new Command()
    registerProfileCommands(program)
    mockDeleteProfile = jest.fn()
    mockProfileManager.mockImplementation(() => ({ deleteProfile: mockDeleteProfile } as any))
    mockExit.mockClear()
  })

  describe('delete command', () => {
    it('should delete profile when confirmed', async () => {
      mockConfirm.mockResolvedValueOnce(true)
      await program.parseAsync(['node', 'test', 'profile', 'delete', 'test-profile'])
      expect(mockDeleteProfile).toHaveBeenCalledWith('test-profile')
    })

    it('should not delete profile when not confirmed', async () => {
      mockConfirm.mockResolvedValueOnce(false)
      await program.parseAsync(['node', 'test', 'profile', 'delete', 'test-profile'])
      expect(mockDeleteProfile).not.toHaveBeenCalled()
    })

    it('should handle deletion errors', async () => {
      mockConfirm.mockResolvedValueOnce(true)
      // @ts-expect-error Mocking error
      mockDeleteProfile.mockRejectedValueOnce(new Error('Cannot delete active profile'))
      await program.parseAsync(['node', 'test', 'profile', 'delete', 'test-profile'])
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })
})
