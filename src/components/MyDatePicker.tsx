import type { FC } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const calendarClass = "react-datepicker";

interface MyDatePickerProps {
  date: Date;
  onDateChange: (date: Date | null) => void;
}

const MyDatePicker: FC<MyDatePickerProps> = ({ date, onDateChange }) => {
  return (
    <div>
      <DatePicker
        selected={date}
        onChange={onDateChange}
        dateFormat="MM/dd/yyyy"
        className={calendarClass}

      />
    </div>
  );
};

export default MyDatePicker;