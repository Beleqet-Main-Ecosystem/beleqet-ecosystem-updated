import { InterviewPlannerService } from './interview-planner.service';

describe('InterviewPlannerService candidate responses', () => {
  const prisma = {
    interview: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  // Only Prisma is used by these methods.
  const service = new InterviewPlannerService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const tomorrow = new Date(Date.now() + 86_400_000);

  beforeEach(() => jest.clearAllMocks());

  it('lets the candidate confirm and tells the employer', async () => {
    prisma.interview.findFirst.mockResolvedValue({
      id: 'i1',
      status: 'SCHEDULED',
      startTime: tomorrow,
      employerId: 'emp',
    });
    await service.respond('cand', 'i1', { response: 'CONFIRMED' });
    expect(prisma.interview.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { status: 'CONFIRMED', candidateNote: null },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'emp' }) }),
    );
  });

  it("only finds the candidate's own interview", async () => {
    prisma.interview.findFirst.mockResolvedValue(null);
    await expect(service.respond('someone', 'i1', { response: 'DECLINED' })).rejects.toThrow(
      'not found',
    );
    expect(prisma.interview.findFirst).toHaveBeenCalledWith({
      where: { id: 'i1', candidateId: 'someone' },
    });
  });

  it('refuses answers to cancelled or past interviews', async () => {
    prisma.interview.findFirst.mockResolvedValue({
      id: 'i1',
      status: 'CANCELLED',
      startTime: tomorrow,
    });
    await expect(service.respond('cand', 'i1', { response: 'CONFIRMED' })).rejects.toThrow(
      'no longer',
    );
    prisma.interview.findFirst.mockResolvedValue({
      id: 'i1',
      status: 'SCHEDULED',
      startTime: new Date(Date.now() - 1000),
    });
    await expect(service.respond('cand', 'i1', { response: 'CONFIRMED' })).rejects.toThrow(
      'already started',
    );
  });

  it('lets only the employer set the place and link', async () => {
    prisma.interview.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateDetails('cand', 'i1', { location: 'Bole office' })).rejects.toThrow(
      'not found',
    );
    expect(prisma.interview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1', employerId: 'cand' } }),
    );
  });
});
