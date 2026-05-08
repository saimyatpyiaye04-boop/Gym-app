export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  notes: string;
}

export interface WorkoutDay {
  day_number: number;
  workout_type: string;
  focus: string;
  exercises: Exercise[];
}

export interface RoutineData {
  routine: WorkoutDay[];
}

export interface LoggedSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
}

export interface LoggedWorkout {
  id?: string;
  day_number: number;
  workout_type: string;
  focus: string;
  date: number;
  exercises: LoggedExercise[];
  isCompleted?: boolean;
}
