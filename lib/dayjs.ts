// Central dayjs configuration with local timezone support
// Import this instead of 'dayjs' directly throughout the app

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

// Use the browser/system local timezone automatically — no hardcoded UTC+6
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
dayjs.tz.setDefault(localTz);

export default dayjs;
