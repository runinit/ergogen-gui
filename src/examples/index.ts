import Example0 from './starter';
import Example1 from './columns';
import Example2 from './thumbs';
import Example3 from './split';
import Example4 from './physical-stack';
import Example5 from './imported-pcb';
import Example6 from './bhk';

export interface ConfigOption {
  readonly value: string;
  readonly label: string;
}
interface GroupedOption {
  readonly label: string;
  readonly options: readonly ConfigOption[];
}
export const exampleOptions: readonly GroupedOption[] = [
  {
    label: 'Native designs',
    options: [
      Example0,
      Example1,
      Example2,
      Example3,
      Example4,
      Example5,
      Example6,
    ],
  },
];
