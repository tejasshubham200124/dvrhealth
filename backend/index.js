const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const xlsxPopulate = require('xlsx-populate');
const path = require('path');
const fs = require('fs');


app.use(express.json());
const port = 8000;

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'esurvfour'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

app.use(cors({
    origin: 'http://localhost:3000'
}));


app.get('/TotalSites', (req, res) => {
    db.query('SELECT COUNT(DISTINCT atmid) AS atmCount FROM dvr_health', (err, result) => {
        if (err) {
            console.error('Error counting ATM IDs:', err);
            res.status(500).json({ error: 'Error counting ATM IDs' });
        } else {
            const atmCount = result[0].atmCount;
            // console.log('Total unique ATM IDs:', atmCount);
            res.status(200).json({ atmCount });
        }
    });
});


app.get('/devicehistory/:atmId', (req, res) => {
    const atmId = req.params.atmId;

    db.query(`
    SELECT 
    *,
    CASE 
        WHEN hdd = 'ok' THEN 'working'
        ELSE 'not working'
    END AS hdd_status,
    CASE 
        WHEN login_status = 0 THEN 'working'
        ELSE 'not working'
    END AS login_status_status,
    DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
    DATE_FORMAT(recording_from, '%Y-%m-%d %H:%i:%s') AS recording_from,
    DATE_FORMAT(recording_to, '%Y-%m-%d %H:%i:%s') AS recording_to,
    DATE_FORMAT(cdate, '%Y-%m-%d %H:%i:%s') AS cdate
FROM 
    dvr_history 
WHERE 
    atmid = ?;
`, [atmId], (err, result) => {
        if (err) {
            console.error('Error fetching history data for ATM ID:', err);
            res.status(500).json({ error: 'Error fetching history data' });
        } else {

            res.status(200).json(result);
        }
    });
});





app.get('/OnlineSites', (req, res) => {
    const query = `
        SELECT COUNT(*) AS online_count
        FROM dvr_health
        WHERE login_status = 0;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error counting online entries:', err);
            res.status(500).json({ error: 'Error counting online entries' });
        } else {
            const { online_count } = result[0];
            res.status(200).json({ online_count });
        }
    });
});


app.get('/OfflineSites', (req, res) => {
    const query = `
        SELECT COUNT(*) AS offline_count
        FROM dvr_health
        WHERE login_status = 1 OR login_status IS NULL;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error counting offline entries:', err);
            res.status(500).json({ error: 'Error counting offline entries' });
        } else {
            const { offline_count } = result[0];
            // console.log('Offline count:', offline_count);
            res.status(200).json({ offline_count });
        }
    });
});


app.get('/hddnotworking', (req, res) => {
    const query = `
        SELECT COUNT(*) AS non_ok_hdd_count FROM dvr_health WHERE NOT (hdd = 'ok' OR hdd = 'OK');
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data:', err);
            res.status(500).json({ error: 'Error fetching DVR health data' });
        } else {
            res.status(200).json(result[0]);
        }
    });
});

app.get('/hddnotworkingsites', (req, res) => {
    const query = `
    SELECT 
    d.ip, 
    d.atmid, 
    d.cam1, 
    d.cam2, 
    d.cam3, 
    d.cam4, 
    DATE_FORMAT(d.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    s.city, 
    s.state, 
    s.zone, 
    d.hdd, 
    CASE 
        WHEN d.login_status = '0' THEN 'working' 
        ELSE 'not working' 
    END AS login_status, 
    DATEDIFF(NOW(), d.cdate) AS days_difference 
FROM 
    dvr_health d 
JOIN 
    sites s 
ON 
    d.atmid = s.atmid 
WHERE 
    NOT (d.hdd = 'ok' OR d.hdd = 'OK') 
    AND s.live = 'Y';


    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/hddwithStatus', (req, res) => {
    const query = `
    SELECT 
    d.ip, 
    d.atmid, 
    d.cam1, 
    d.cam2, 
    d.cam3, 
    d.cam4, 
    DATE_FORMAT(d.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    s.city, 
    s.state, 
    s.zone, 
    d.hdd, 
    CASE 
        WHEN d.login_status = '0' THEN 'working' 
        ELSE 'not working' 
    END AS login_status, 
    DATEDIFF(NOW(), d.cdate) AS days_difference 
FROM 
    dvr_health d 
JOIN 
    sites s 
ON 
    d.atmid = s.atmid;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/summaryData', (req, res) => {
    const query = `
    SELECT hdd, COUNT(*) AS count_per_value FROM dvr_health GROUP BY hdd;
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});

app.get('/unformattedSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, 
    dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, 
    dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, 
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    dh.hdd = 'unformatted'
    AND s.live = 'Y';

    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/abnormalSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, 
    dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, 
    dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, -- Calculate login status
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    dh.hdd = 'abnormal' -- Filter for 'abnormal' condition
    AND s.live = 'Y';
;
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/NullSites', (req, res) => {
    const query = `
    SELECT
    dh.ip,
    dh.cam1,
    dh.cam2,
    dh.cam3,
    dh.cam4,
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
    dh.atmid,
    dh.recording_from,
    dh.recording_to,
    s.City,
    s.State,
    s.Zone,
    CASE
        WHEN dh.login_status = 0 THEN 'working'
        ELSE 'not working'
    END AS login_status,
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference
FROM
    dvr_health dh
JOIN
    sites s ON dh.atmid = s.ATMID
WHERE
    dh.hdd IS NULL
    AND s.live = 'Y';

    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/noDiscIdleSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, 
    dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, 
    dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, -- Calculate login status
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    dh.hdd = 'No disk/idle'
    AND s.live = 'Y';

    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/errorSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, -- Calculate login status
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    dh.hdd IN ('Error', '1', '2')
    AND s.live = 'Y';
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/NoDiskSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, -- Calculate login status
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    dh.hdd = 'No Disk'
    AND s.live = 'Y';
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/okSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status, -- Calculate login status
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference -- Calculate days difference
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
(dh.hdd = 'ok' OR dh.hdd = 'OK')
    AND s.live = 'Y';
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/notexistSites', (req, res) => {
    const query = `
    SELECT 
    dh.ip, 
    dh.cam1, dh.cam2, dh.cam3, dh.cam4, 
    DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, 
    dh.atmid, 
    dh.recording_from, dh.recording_to,
    s.City, s.State, s.Zone,
    DATEDIFF(CURDATE(), dh.cdate) AS days_difference, -- Calculate days difference
    CASE WHEN dh.login_status = 0 THEN 'working' ELSE 'not working' END AS login_status -- Calculate login status
FROM 
    dvr_health dh
JOIN 
    sites s ON dh.atmid = s.ATMID
WHERE 
    (dh.hdd = 'Not exist' OR dh.hdd = 'notexist')
    AND s.live = 'Y';

    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/hddcalllog', (req, res) => {
    const query = `
   
    SELECT
    dh.atmid,
    latest_history.last_communication,
    latest_history.hdd AS from_hdd,
    dh.hdd AS to_hdd
FROM
    dvr_health dh
JOIN (
    SELECT
        atmid,
        last_communication,
        hdd
    FROM
        dvr_history
    WHERE
        (atmid, last_communication) IN (
            SELECT
                atmid,
                MAX(last_communication)
            FROM
                dvr_history
            GROUP BY
                atmid
        )
        AND (hdd IS NOT NULL AND hdd <> '') -- Exclude rows with null or blank hdd
) AS latest_history ON dh.atmid = latest_history.atmid
WHERE
    dh.hdd <> latest_history.hdd
ORDER BY
    latest_history.last_communication DESC;


    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR history data:', err);
            res.status(500).json({ error: 'Error fetching DVR history data' });
        } else {
            res.status(200).json(result);
        }
    });
});





app.get('/CameraNotWorking', (req, res) => {
    const query = `
    SELECT COUNT(CASE WHEN cam1 = 'not working' THEN 1 END) AS cam1_count, COUNT(CASE WHEN cam2 = 'not working' THEN 1 END) AS cam2_count, COUNT(CASE WHEN cam3 = 'not working' THEN 1 END) AS cam3_count, COUNT(CASE WHEN cam4 = 'not working' THEN 1 END) AS cam4_count FROM dvr_health;;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error counting "not working" or "null" entries:', err);
            res.status(500).json({ error: 'Error counting "not working" or "null" entries' });
        } else {
            const counts = {
                cam1_count: result[0].cam1_count,
                cam2_count: result[0].cam2_count,
                cam3_count: result[0].cam3_count,
                cam4_count: result[0].cam4_count
            };
            res.status(200).json(counts);
        }
    });
});

app.get('/cam1_not_working', (req, res) => {
    const query = `
        SELECT ip, cam1,
            CASE WHEN hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            CASE WHEN login_status = 0 THEN 'working' ELSE 'not working' END AS login_status,
            DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, atmid, recording_from, recording_to, dvrtype
        FROM dvr_health
        WHERE cam1 = 'not working';
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error retrieving data where cam1 is not working:', err);
            res.status(500).json({ error: 'Error retrieving data' });
        } else {
            // console.log('Data where cam1 is not working:', result);
            res.status(200).json(result);
        }
    });
});
app.get('/cam2_not_working', (req, res) => {
    const query = `
        SELECT ip, cam2,
            CASE WHEN hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            CASE WHEN login_status = 0 THEN 'working' ELSE 'not working' END AS login_status,
            DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, atmid, recording_from, recording_to, dvrtype
        FROM dvr_health
        WHERE cam2 = 'not working';
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error retrieving data where cam1 is not working:', err);
            res.status(500).json({ error: 'Error retrieving data' });
        } else {
            // console.log('Data where cam1 is not working:', result);
            res.status(200).json(result);
        }
    });
});
app.get('/cam3_not_working', (req, res) => {
    const query = `
        SELECT ip, cam3,
            CASE WHEN hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            CASE WHEN login_status = 0 THEN 'working' ELSE 'not working' END AS login_status,
            DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, atmid, recording_from, recording_to, dvrtype
        FROM dvr_health
        WHERE cam3 = 'not working';
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error retrieving data where cam1 is not working:', err);
            res.status(500).json({ error: 'Error retrieving data' });
        } else {
            // console.log('Data where cam1 is not working:', result);
            res.status(200).json(result);
        }
    });
});
app.get('/cam4_not_working', (req, res) => {
    const query = `
        SELECT ip, cam4,
            CASE WHEN hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            CASE WHEN login_status = 0 THEN 'working' ELSE 'not working' END AS login_status,
            DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication, atmid, recording_from, recording_to, dvrtype
        FROM dvr_health
        WHERE cam4 = 'not working';
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error retrieving data where cam1 is not working:', err);
            res.status(500).json({ error: 'Error retrieving data' });
        } else {
            // console.log('Data where cam1 is not working:', result);
            res.status(200).json(result);
        }
    });
});

app.get('/neveron', (req, res) => {
    const query = `
    SELECT COUNT(*) AS neveron FROM dvr_health WHERE cdate IS NULL OR cdate = '';
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error counting data where last_communication is not today:', err);
            res.status(500).json({ error: 'Error counting data' });
        } else {
            const { neveron } = result[0];
            // console.log('Count of data where last_communication is not today:', neveron);
            res.status(200).json({ neveron });
        }
    });
});


app.get('/neverondetails', (req, res) => {
    const query = `
    SELECT
    dvr_health.atmid,
    dvr_health.ip,
    sites.CITY,
    sites.STATE,
    sites.ZONE,
    sites.SiteAddress
FROM
    dvr_health
JOIN
    sites
ON
    dvr_health.atmid = sites.ATMID
WHERE
    dvr_health.cdate IS NULL OR dvr_health.cdate = '';
;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: 'Error executing query' });
        } else {
            res.status(200).json(result);
        }
    });
});










app.get('/TimeDifferenceDetails', (req, res) => {
    const page = req.query.page || 1;
    const recordsPerPage = 50;
    const offset = (page - 1) * recordsPerPage;

    const query = `
        SELECT
            dvr_health.atmid,         
            DATE_FORMAT(dvr_health.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dvr_health.cam1,
            dvr_health.cam2,
            dvr_health.cam3,
            dvr_health.cam4,
            CASE
            WHEN dvr_health.login_status = 0 THEN 'working'
            ELSE 'not working'
        END AS login_status,
            DATE_FORMAT(dvr_health.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dvr_health.ip,
            CASE WHEN dvr_health.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            sites.city,
            sites.state,
            sites.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health
        JOIN
            sites ON dvr_health.atmid = sites.ATMID
        WHERE
        dvr_health.login_status = 0
         AND   sites.live = 'Y'
        LIMIT ${recordsPerPage} OFFSET ${offset};
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data:', err);
            res.status(500).json({ error: 'Error fetching DVR health data' });
        } else {
            const totalCountQuery = 'SELECT COUNT(*) AS total__count FROM dvr_health WHERE login_status = 0';
            db.query(totalCountQuery, (err, countResult) => {
                if (err) {
                    console.error('Error fetching total count of records:', err);
                    res.status(500).json({ error: 'Error fetching total count of records' });
                } else {
                    res.status(200).json({ data: result, totalCount: countResult[0].total__count });
                }
            });
        }
    });
});





app.get('/TotalHours', (req, res) => {
    const query = `
    SELECT
    COUNT(DISTINCT dvr_health.atmid) AS total_sites
FROM
    dvr_health
JOIN
    sites ON dvr_health.atmid = sites.ATMID
WHERE
    dvr_health.login_status = 0
    AND sites.live = 'Y';

    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error counting online entries:', err);
            res.status(500).json({ error: 'Error counting online entries' });
        } else {
            const { total_sites } = result[0];

            res.status(200).json({ total_sites });
        }
    });
});

app.get('/30DaysAging', (req, res) => {
    const query = `
        SELECT
            dvr_health.atmid,
            
            sites.city,
            sites.state,
            sites.zone,
            DATEDIFF(NOW(), dvr_health.cdate) AS days_difference
        FROM
            dvr_health
        JOIN
            sites ON dvr_health.atmid = sites.ATMID
        WHERE
            (dvr_health.login_status = 1 OR dvr_health.login_status IS NULL)
            AND sites.live = 'Y'
            AND DATEDIFF(NOW(), dvr_health.cdate) > 30;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: 'Error executing query' });
        } else {
            res.status(200).json(result);
        }
    });
});

app.get('/30DaysAgingDetails', (req, res) => {
    const query = `
        SELECT
            dvr_health.atmid,
            DATE_FORMAT(dvr_health.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,      
            CASE
            WHEN dvr_health.login_status = 0 THEN 'working'
            ELSE 'not working'
        END AS login_status,
            dvr_health.ip,
            CASE WHEN dvr_health.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()), 60)) AS time_difference_hours_minutes,
            sites.city,
            sites.state,
            sites.zone,
            DATEDIFF(NOW(), dvr_health.cdate) AS days_difference
        FROM
            dvr_health
        JOIN
            sites ON dvr_health.atmid = sites.ATMID
        WHERE
            (dvr_health.login_status = 1 OR dvr_health.login_status IS NULL)
            AND sites.live = 'Y'
            AND DATEDIFF(NOW(), dvr_health.cdate) > 30;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: 'Error executing query' });
        } else {
            res.status(200).json(result);
        }
    });
});


app.get('/30DaysAgingCount', (req, res) => {
    const query = `
        SELECT
            COUNT(*) AS count
        FROM
            dvr_health
        JOIN
            sites ON dvr_health.atmid = sites.ATMID
        WHERE
            (dvr_health.login_status = 1 OR dvr_health.login_status IS NULL)
            AND sites.live = 'Y'
            AND DATEDIFF(NOW(), dvr_health.cdate) > 30;
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            res.status(500).json({ error: 'Error executing query' });
        } else {
            res.status(200).json({ count: result[0].count });
        }
    });
});

app.get('/OfflineSiteDetails', (req, res) => {
    const page = req.query.page || 1;
    const recordsPerPage = 50;
    const offset = (page - 1) * recordsPerPage;
    const atmid = req.query.atmid || '';

    let query = `
        SELECT
            dh.atmid,
            dh.login_status,
            DATE_FORMAT(dh.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dh.ip AS routerip,
            CASE WHEN dh.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            s.city,
            s.state,
            s.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health dh
        JOIN
            sites s ON dh.atmid = s.ATMID
        WHERE
            dh.login_status = 1 OR dh.login_status IS NULL
            AND s.live = 'Y'`;

    if (atmid) {
        query += ` AND dh.atmid LIKE '%${atmid}%'`;
    }

    query += ` LIMIT ${recordsPerPage} OFFSET ${offset};`;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data:', err);
            res.status(500).json({ error: 'Error fetching DVR health data' });
        } else {
            if (!atmid) {
                const totalCountQuery = `SELECT COUNT(*) AS offline_count 
                FROM dvr_health 
                WHERE (login_status = 0 OR login_status IS NULL) 
                      AND live = 'Y';
                `;
                db.query(totalCountQuery, (err, countResult) => {
                    if (err) {
                        console.error('Error fetching total count of records:', err);
                        res.status(500).json({ error: 'Error fetching total count of records' });
                    } else {
                        res.status(200).json({ data: result, totalCount: countResult[0].offline_count });
                    }
                });
            } else {
                res.status(200).json({ data: result });
            }
        }
    });
});


app.get('/OnlineSiteDetails', (req, res) => {
    const page = req.query.page || 1;
    const recordsPerPage = 50;
    const offset = (page - 1) * recordsPerPage;
    const atmid = req.query.atmid || '';

    let query = `
        SELECT
            dh.atmid,
            dh.login_status,
            DATE_FORMAT(dh.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dh.ip AS routerip,
            CASE WHEN dh.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            s.city,
            s.state,
            s.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health dh
        JOIN
            sites s ON dh.atmid = s.ATMID
        WHERE
            dh.login_status = 0
            AND s.live = 'Y'`;

    if (atmid) {
        query += ` AND dh.atmid LIKE '%${atmid}%'`;
    }

    query += ` LIMIT ${recordsPerPage} OFFSET ${offset};`;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data:', err);
            res.status(500).json({ error: 'Error fetching DVR health data' });
        } else {
            if (!atmid) {
                const totalCountQuery = `SELECT COUNT(*) AS online_count FROM dvr_health WHERE login_status = 0`;
                db.query(totalCountQuery, (err, countResult) => {
                    if (err) {
                        console.error('Error fetching total count of records:', err);
                        res.status(500).json({ error: 'Error fetching total count of records' });
                    } else {
                        res.status(200).json({ data: result, totalCount: countResult[0].online_count });
                    }
                });
            } else {
                res.status(200).json({ data: result });
            }
        }
    });
});


app.get('/devicehistoryTwo/:atmId', (req, res) => {
    const recordsPerPage = 50;
    const page = req.query.page || 1;
    const offset = (page - 1) * recordsPerPage;
    const atmId = req.params.atmId;

    console.log('Received search ATM ID:', atmId);

    let query = `
    SELECT 
        *,
        CASE 
            WHEN hdd = 'ok' THEN 'working'
            ELSE 'not working'
        END AS hdd_status,
        CASE 
            WHEN login_status = 0 THEN 'working'
            ELSE 'not working'
        END AS login_status_status,
        DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
        DATE_FORMAT(recording_from, '%Y-%m-%d %H:%i:%s') AS recording_from,
        DATE_FORMAT(recording_to, '%Y-%m-%d %H:%i:%s') AS recording_to,
        DATE_FORMAT(cdate, '%Y-%m-%d %H:%i:%s') AS cdate
    FROM 
        dvr_history 
    WHERE 
        atmid = ?`;

    query += ` LIMIT ${recordsPerPage} OFFSET ${offset};`;

    db.query(query, [atmId], (err, result) => {
        if (err) {
            console.error('Error fetching history data for ATM ID:', err);
            res.status(500).json({ error: 'Error fetching history data' });
        } else {
            const totalCountQuery = `SELECT COUNT(*) AS totalCount FROM dvr_history WHERE atmid = ?`;
            db.query(totalCountQuery, [atmId], (err, countResult) => {
                if (err) {
                    console.error('Error fetching total count of records:', err);
                    res.status(500).json({ error: 'Error fetching total count of records' });
                } else {
                    res.status(200).json({ data: result, totalCount: countResult[0].totalCount });
                }
            });
        }
    });
});



app.get('/AllSites', (req, res) => {
    const recordsPerPage = 50;
    const page = req.query.page || 1;
    const offset = (page - 1) * recordsPerPage;
    const atmid = req.query.atmid || '';


    console.log('Received search ATM ID:', atmid);

    let query = `
        SELECT
            dh.ip,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            dh.latency,
            CASE
                WHEN dh.hdd = 'ok' THEN 'working'
                ELSE 'not working'
            END AS hdd_status,
            CASE
                WHEN dh.login_status = 0 THEN 'working'
                ELSE 'not working'
            END AS login_status,
            dh.atmid,
            dh.dvrtype,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            s.City,
            s.State,
            s.Zone
        FROM
            dvr_health dh
        JOIN
            sites s
        ON
            dh.atmid = s.ATMID`;

    if (atmid) {
        query += ` WHERE LOWER(dh.atmid) LIKE '%${atmid.toLowerCase()}%'`;
    }

    query += ` LIMIT ${recordsPerPage} OFFSET ${offset};`;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data:', err);
            res.status(500).json({ error: 'Error fetching DVR health data' });
        } else {
            if (!atmid) {
                const totalCountQuery = `SELECT COUNT(*) AS totalCount FROM dvr_health`;
                db.query(totalCountQuery, (err, countResult) => {
                    if (err) {
                        console.error('Error fetching total count of records:', err);
                        res.status(500).json({ error: 'Error fetching total count of records' });
                    } else {
                        res.status(200).json({ data: result, totalCount: countResult[0].totalCount });
                    }
                });
            } else {
                res.status(200).json({ data: result });
            }
        }
    });
});

app.get('/ExportAllSites', (req, res) => {
    const atmid = req.query.atmid || '';

    let query = `
        SELECT
            dh.ip,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            dh.latency,
            CASE
                WHEN dh.hdd = 'ok' THEN 'working'
                ELSE 'not working'
            END AS hdd_status,
            CASE
                WHEN dh.login_status = 0 THEN 'working'
                ELSE 'not working'
            END AS login_status,
            dh.atmid,
            dh.dvrtype,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            s.City,
            s.State,
            s.Zone
        FROM
            dvr_health dh
        JOIN
            sites s
        ON
            dh.atmid = s.ATMID`;

    if (atmid) {
        query += ` WHERE LOWER(dh.atmid) LIKE '%${atmid.toLowerCase()}%'`;
    }

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data for export:', err);
            res.status(500).json({ error: 'Error fetching DVR health data for export' });
        } else {
            res.status(200).json({ data: result });
        }
    });
});

app.get('/ExportOnlineSites', (req, res) => {


    const atmid = req.query.atmid || '';

    let query = `
        SELECT
            dh.atmid,
            dh.login_status,
            DATE_FORMAT(dh.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dh.ip AS routerip,
            CASE WHEN dh.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            s.city,
            s.state,
            s.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health dh
        JOIN
            sites s ON dh.atmid = s.ATMID
        WHERE
            dh.login_status = 0
            AND s.live = 'Y'`;

    if (atmid) {
        query += ` AND dh.atmid LIKE '%${atmid}%'`;
    }

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data for export:', err);
            res.status(500).json({ error: 'Error fetching DVR health data for export' });
        } else {
            res.status(200).json({ data: result });
        }
    });
});

app.get('/ExportOfflineSites', async (req, res) => {
    const atmid = req.query.atmid || '';

    let query = `
        SELECT
            dh.atmid,
            dh.login_status,
            DATE_FORMAT(dh.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dh.cam1,
            dh.cam2,
            dh.cam3,
            dh.cam4,
            DATE_FORMAT(dh.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dh.ip AS routerip,
            CASE WHEN dh.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            s.city,
            s.state,
            s.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dh.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health dh
        JOIN
            sites s ON dh.atmid = s.ATMID
        WHERE
            dh.login_status = 1 OR dh.login_status IS NULL
            AND s.live = 'Y'`;

    if (atmid) {
        query += ` AND dh.atmid LIKE '%${atmid}%'`;
    }

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data for export:', err);
            res.status(500).json({ error: 'Error fetching DVR health data for export' });
        } else {
            res.status(200).json({ data: result });
        }
    });
});


app.get('/TimeDifferenceExport', (req, res) => {


    const query = `
        SELECT
            dvr_health.atmid,         
            DATE_FORMAT(dvr_health.cdate, '%Y-%m-%d %H:%i:%s') AS cdate,
            dvr_health.cam1,
            dvr_health.cam2,
            dvr_health.cam3,
            dvr_health.cam4,
            CASE
            WHEN dvr_health.login_status = 0 THEN 'working'
            ELSE 'not working'
        END AS login_status,
            DATE_FORMAT(dvr_health.last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
            dvr_health.ip,
            CASE WHEN dvr_health.hdd = 'ok' THEN 'working' ELSE 'not working' END AS hdd_status,
            sites.city,
            sites.state,
            sites.zone,
            CONCAT(FLOOR(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()) / 60), ':', MOD(TIMESTAMPDIFF(MINUTE, dvr_health.cdate, NOW()), 60)) AS time_difference_hours_minutes
        FROM
            dvr_health
        JOIN
            sites ON dvr_health.atmid = sites.ATMID
        WHERE
        dvr_health.login_status = 0
         AND   sites.live = 'Y'
       
    `;


    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data for export:', err);
            res.status(500).json({ error: 'Error fetching DVR health data for export' });
        } else {
            res.status(200).json({ data: result });
        }
    });
});


app.get('/DeviceHistoryExport', (req, res) => {


    const query = `
    SELECT 
    *,
    CASE 
        WHEN hdd = 'ok' THEN 'working'
        ELSE 'not working'
    END AS hdd_status,
    CASE 
        WHEN login_status = 0 THEN 'working'
        ELSE 'not working'
    END AS login_status_status,
    DATE_FORMAT(last_communication, '%Y-%m-%d %H:%i:%s') AS last_communication,
    DATE_FORMAT(recording_from, '%Y-%m-%d %H:%i:%s') AS recording_from,
    DATE_FORMAT(recording_to, '%Y-%m-%d %H:%i:%s') AS recording_to,
    DATE_FORMAT(cdate, '%Y-%m-%d %H:%i:%s') AS cdate
FROM 
    dvr_history 
WHERE 
    atmid = ?;
 [atmId],     
    `;


    db.query(query, (err, result) => {
        if (err) {
            console.error('Error fetching DVR health data for export:', err);
            res.status(500).json({ error: 'Error fetching DVR health data for export' });
        } else {
            res.status(200).json({ data: result });
        }
    });
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});