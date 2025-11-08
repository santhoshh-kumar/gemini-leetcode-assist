export const GoogleGenAI = jest.fn().mockImplementation(() => ({
  models: {
    generateContentStream: jest.fn(),
  },
}));

export const GenerationConfig = {};

export const Content = {};
