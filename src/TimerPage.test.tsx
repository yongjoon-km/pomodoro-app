import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import TimerPage from './TimerPage';
import userEvent from '@testing-library/user-event';
import {server, rest} from './mocks/server';
import {cache} from 'swr'


const WORK_TIME = 1500;
const SHORT_BREAK = 300;
const SPRINT_SEC = 1500;
const BREAK_SEC = 300;

describe('TimerPage Test', () => {
  afterEach(() => cache.clear())

  describe('Timer functionality Test in TimerPage', () => {

    afterEach(() => cache.clear())
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers())

    function passTimer(sec: number, offset?: number) {
      const offsetSec = offset || 0;
      act(() => {jest.advanceTimersByTime(1001 * (sec + offsetSec))})
    }

    function passWorkTime() {
      passTimer(SPRINT_SEC, 0)
    }
    function passShortBreak() {
      passTimer(BREAK_SEC, 0);
    }

    it('should render breaking session after pomodoro session complete', () => {
      render(<TimerPage />);
      const startButton = screen.getByRole('button', {
        name: 'start',
      });
      userEvent.click(startButton);
      passWorkTime();
      // should query timer after time passed because it is re mounted using key props
      const timer: HTMLSpanElement = screen.getByLabelText('timer');
      expect(timer).toHaveTextContent('05:00');
    });

    it('should render long breaking session after 4 pomodoro session complete', () => {
      render(<TimerPage />);
      const startButton = screen.getByRole('button', {name: 'start'});
      userEvent.click(startButton);
      passWorkTime(); // 1 session
      passShortBreak();
      passWorkTime(); // 2 session
      passShortBreak();
      passWorkTime(); // 3 session
      passShortBreak();
      passWorkTime(); // 4 session
      const timer: HTMLSpanElement = screen.getByLabelText('timer');
      expect(timer).toHaveTextContent('15:00');
    });

    it.skip('should increase done count when one sprint is done', async () => {
      jest.useRealTimers();
      const {debug} = render(<TimerPage />);
      const button = await screen.findByText(/first todo/i);
      userEvent.click(button);
      expect(screen.getByText(/0 \/ 1/i));
      jest.useFakeTimers()
      const startButton = screen.getByRole('button', {name: 'start'});
      userEvent.click(startButton);
      passWorkTime(); // 1 session
      passWorkTime(); // 1 session
      passWorkTime(); // 1 session
      debug();
      const timer: HTMLSpanElement = screen.getByLabelText('timer');
      expect(timer).toHaveTextContent('05:00');
      await waitFor(() => expect(screen.getByText(/1 \/ 1/i)));
    });

  })

  it('should render new button for creating todo list', () => {
    render(<TimerPage />);
    screen.getByRole('button', {name: /new todo/i});
  });

  it('should render todo form when user clicks new todo button', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    screen.getByRole('button', {name: /save/i});
    screen.getByLabelText(/title for new todo/i);
    screen.getByLabelText(/amount of sprint for new todo/i);
    screen.getByLabelText(/increase sprint/i);
    screen.getByLabelText(/decrease sprint/i);
    expect(screen.queryByText(/new todo/i)).toBeFalsy();
  });

  it('hides New todo form after user save a new todo', async () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const titleInput = screen.getByLabelText(/title for new todo/i);
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    const saveButton = screen.getByRole('button', {name: /save/i});
    userEvent.type(titleInput, 'New Todo');
    userEvent.click(sprintUpButton);
    userEvent.click(saveButton);
    await waitFor(() => expect(screen.queryByRole('button', {name: /save/i})).toBeFalsy());
    expect(screen.queryByLabelText(/title for new todo/i)).toBeFalsy();
    expect(screen.queryByLabelText(/increase sprint/i)).toBeFalsy();
    expect(screen.queryByLabelText(/decrease sprint/i)).toBeFalsy();
  });

  it('should render new todo button when user cancle to create new todo', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    userEvent.click(screen.getByRole('button', {name: /cancel/i}));
    screen.getByText(/new todo/i);
    expect(screen.queryByRole('button', {name: /save/i})).toBeFalsy();
    expect(screen.queryByLabelText(/title for new todo/i)).toBeFalsy();
    expect(screen.queryByLabelText(/increase sprint/i)).toBeFalsy();
    expect(screen.queryByLabelText(/decrease sprint/i)).toBeFalsy();
  });

  it('should control sprint selection by up and down button', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    const sprintDownButton = screen.getByLabelText(/decrease sprint/i);
    const sprintSelection = screen.getByLabelText(
      /amount of sprint for new todo/i,
    ) as HTMLInputElement;
    userEvent.click(sprintUpButton);
    expect(sprintSelection.value).toEqual('1');
    userEvent.click(sprintDownButton);
    expect(sprintSelection.value).toEqual('0');
  });

  it('should add new todo item when fill the title, sprint and clicks new button', async () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const newTitle = 'Newly Created Todo';
    const saveFormButton = screen.getByRole('button', {name: /save/i});
    const titleInput = screen.getByLabelText(/title for new todo/i);
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    userEvent.type(titleInput, newTitle);
    userEvent.click(sprintUpButton);
    server.use(
      rest.post('/todos', async (req, res, ctx) => {
        return res(ctx.status(201), ctx.json({
          title: newTitle,
          sprintTotal: 1,
          sprintDone: 0,
          todoDone: false,
        }));
      }),
      rest.get('/todos', async (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([
          {
            id: 100,
            title: newTitle,
            sprintTotal: 1,
            sprintDone: 0,
            todoDone: false,
          }
        ]));
      }),
    )
    userEvent.click(saveFormButton);
    await screen.findByText(/newly created todo/i);
  });

  it('should remove todos when clicks delete button', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const newTitle = 'newTitle';
    const saveFormButton = screen.getByRole('button', {name: /save/i});
    const titleInput = screen.getByLabelText(/title for new todo/i);
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    userEvent.type(titleInput, newTitle);
    userEvent.click(sprintUpButton);
    userEvent.click(saveFormButton);
    const deleteButton = screen.getByLabelText(/delete/i);
    userEvent.click(deleteButton);
    expect(screen.queryByText(newTitle)).toBeFalsy();
  });

  it.skip('should render done when user clicks done button and it toggles', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const newTitle = 'newTitle';
    const saveFormButton = screen.getByRole('button', {name: /save/i});
    const titleInput = screen.getByLabelText(/title for new todo/i);
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    userEvent.type(titleInput, newTitle);
    userEvent.click(sprintUpButton);
    userEvent.click(saveFormButton);
    const todoNotDoneIconButton = screen.getByLabelText(/todo finish switch/i);
    userEvent.click(todoNotDoneIconButton);
    expect(screen.getByLabelText(/todo done/i)).to.exist;
    userEvent.click(todoNotDoneIconButton);
    expect(screen.queryByLabelText(/todo done/i)).to.not.exist;
  });

  it.skip('can edit todo item on the list by edit button interface', () => {
    render(<TimerPage />);
    userEvent.click(screen.getByText(/new todo/i));
    const newTitle = 'newTitle';
    const saveFormButton = screen.getByRole('button', {name: /save/i});
    const titleInput = screen.getByLabelText(/title for new todo/i);
    const sprintUpButton = screen.getByLabelText(/increase sprint/i);
    userEvent.type(titleInput, newTitle);
    userEvent.click(sprintUpButton);
    userEvent.click(saveFormButton);
    const editTodoButton = screen.getByLabelText(/edit/i);
    userEvent.click(editTodoButton);
    const editTodoTitleInput =
      screen.getAllByLabelText(/title for new todo/i)[0];
    const editTodoSprintUpButton =
      screen.getAllByLabelText(/increase sprint/i)[0];
    const editedTitle = ' edited';
    const saveEditTodoButton = screen.getAllByRole('button', {
      name: /save/i,
    })[0];
    userEvent.type(editTodoTitleInput, editedTitle);
    userEvent.click(editTodoSprintUpButton);
    userEvent.click(saveEditTodoButton);
    expect(screen.getByText(newTitle + editedTitle)).to.exist;
    expect(screen.getByText(/0 \/ 2/i)).to.exist;
  });

  it('should render todos from the server response', async () => {
    render(<TimerPage />)

    await screen.findByText(/first todo/i)
  })
});
