/**
 * HCPSS canvas instance extension
 *
 * @TODO: Investigate ways to speed up rendering awaiting fewer actions
 */

DEBUG = false;

BASE_URL = "https://hcpss.instructure.com/api/v1";

function Student(id) {
    this.id = id;
}

/* Strip the while(1) prefix from API responses. We are not embedding
 * content directly, so let's manipulate as needed.
 */
function unpackAPIResponse(response) {
    return JSON.parse(response.replace('while(1);', ''));
}

/* Parse out the link field in a response header.
 * Returns an object with current, next, last, and first elements
 */
function parseLinkHeader(linkHeader) {
    var pages = {};

    if (linkHeader == null)
        return pages;
    
    var links = linkHeader.split(",");
    
    for (var i = 0; i < links.length; i++) {
        let m = links[i].match(/<(https:.*)>.*rel="(.*)"/);
        let rel = m[2];
        let page = m[1];
        pages[rel] = page;
    }

    return pages
}

/* Utility function to inspect access_restricted_by_date property.
 *
 * @TODO: Validation checks.
 * @TODO: Inline?
 */
function filterInactiveClasses(classList) {
    return classList.filter(course => !('access_restricted_by_date' in course));
}

/* Utility function to fetch paginated API responses by inspecting the next link
 * and aggregating all results.
 *
 * returns all responses across all pages.
 *
 * @TODO: This could potentially cause issues for large responses.
 */
async function getAllResponses(url) {
    let allResponses = await fetch(url).then(async function(response) {
        let results = await response.text().then(unpackAPIResponse);
        links = parseLinkHeader(response.headers.get("link"));
        while ("next" in links) {
            let nextResponse = await fetch(links["next"]);
            let newResults = await nextResponse.text().then(unpackAPIResponse);
            if (Object.keys(newResults).length == 0) {
                break;
            }
            links = parseLinkHeader(nextResponse.headers.get("link"));
            results = results.concat(newResults);
        }
        return results;
    });;

    return allResponses;
}

/* Given a student and a course object, fetch all assignments with unsubmitted
 * submissions.
 *
 * Return list of assignments.
 *
 * @TODO: Make the filter optional
 * @TODO: Support additional filter types
 * @TODO: Investigate API. The include[] field ought to do what we need.
 */
async function getAllAssignmentsForCourse(student, course) {
    
    let url = BASE_URL + `/users/${student.id}/courses/${course['id']}/` + 
        "assignments?page=1&per_page=10";

    let assignments = await getAllResponses(url);
    
    assignments = assignments.filter(as => (as.due_at != null) &&
        (Date.now() < new Date(as["due_at"])) &&
        (Date.now() > new Date(as["unlock_at"])));

    for (let j = 0; j < assignments.length; j++) {
        let assignment = assignments[j];
        
        let submissionUrl = BASE_URL + `/courses/${course["id"]}/assignments/` +
            `${assignment["id"]}/submissions/${student.id}`;
        let submissions = await getAllResponses(submissionUrl);
        assignment["submission"] = submissions;
    }
    let unsubmitted = assignments.filter(
        // Only select assignments that have unsubmitted submissions
        assignment => assignment.submission["workflow_state"] == "unsubmitted"
    );
    // How much do we trust the API to order these assignments?
    return unsubmitted.sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
}

/* Given a list of assignments, convert them to pretty HTML and
 * populate the listElement with each assignment.
 */
function renderUnsubmittedAssignmentList(assignments, listElement) {
    for (let i = 0; i < assignments.length; i++) {
        let assignment = assignments[i];

        /*
         * This code sets up the following structure.
         * <li>
         *     <a href=[Assignment URL]>Assignment</a>
         *     <p>Due at [Due Date]</p>
         * </li>
         *
         * This list item is appended to the listElement which is an unordered
         * list.
         */
        let item = document.createElement("li");
        let assignmentLink = document.createElement("a");
        let dueDate = document.createElement("p");
        
        assignmentLink.setAttribute("href", `${assignment["html_url"]}`);
        assignmentLink.innerHTML = assignment.name;

        let due = new Date(assignment["due_at"]);
        let hour = due.getHours();
        let period = "AM";
        if (hour >= 12) {
            period = "PM";
            if (hour > 12)
                hour = hour % 12;
        }
        let minutes = due.getMinutes();
        if (minutes < 10) {
            minutes = "0"+minutes;
        }
        dueDate.innerHTML = `Due on ${due.toDateString()} at ${hour}:${minutes} ${period}`;
        item.appendChild(assignmentLink);
        item.appendChild(dueDate);
        item.className = assignment["due_at"];

        listElement.append(item);
    }

}

/* Fetch all assignments for a student across all active courses and populate
 * studentElement with a list of outstanding assignments
 */
async function fetchAllAssignments(student, studentElement) {
    let url = BASE_URL + `/users/${student.id}/courses?page=1&per_page=10`;
    
    let courses = await getAllResponses(url).then(filterInactiveClasses);

    for (let i = 0; i < courses.length; i++) {
        let course = courses[i];
        
        /*
         * This code sets up the following structure. The unordered list element
         * is then updated as assignments are collected.
         * <div>
         *   <a href=/courses/[course id]><h2>Course Name</h2></a>
         *   <ul>
         *   </ul>
         * </div>
         */
        let container = document.createElement("div");
        container.style = "display:none";
        let headerLink = document.createElement("a");
        headerLink.setAttribute("href", `/courses/${course["id"]}`);

        let header = document.createElement("h2");
        header.innerHTML = course["name"];
        headerLink.appendChild(header);

        container.appendChild(headerLink);
        let list = document.createElement("ul");
        
        container.appendChild(list);
        studentElement.appendChild(container);

        getAllAssignmentsForCourse(student, course).then(function (assignments) {
            if (assignments.length > 0) {
                container.style = "";
            }
            renderUnsubmittedAssignmentList(assignments, list);
        });

    }
}

// Keep retrying for 5 minutes
const maxWaitForLoad = 5*60*1000;

var timeSpentWaitingForLoad = 0;

/* Wait for the side-bar to load before attempting to modify it. */
function waitForLoad () {
    /* @TODO: This is one of the most brittle part of the whole thing.
     * Make this a bit more stable.
     */
    const el = document.getElementsByClassName("events_list");

    if (el.length) {
        populateSidebar();
    }
    else {
        if (timeSpentWaitingForLoad < maxWaitForLoad) {
            timeSpentWaitingForLoad += 300;
            setTimeout(waitForLoad, 300); // try again in 300 milliseconds
        }
        else {
            if(DEBUG) console.log("Timeout out...");
        }
    }
}

/*
 * Add all the assignments for a given student to the listElement containing
 * assignments for all students.
 *
 * id can be a numeric ID or "self" as per the v1 API specification
 */
async function addStudentAssignments(id, displayName, listElement) {
    let container = document.createElement("div");
    let header = document.createElement("h3");
    header.innerHTML = `${displayName} Unsubmitted Assignments`;
    container.appendChild(header);
    listElement.appendChild(container);
    fetchAllAssignments(new Student(id), container);
}

async function populateSidebar() {
    /*
     * @TODO: This is still pretty brittle. Who's to say this element will be
     * around forever
     */
    var sidebar = document.getElementById("right-side");

    let url = `${BASE_URL}/users/self/observees`;
    
    // Query API for all observees
    // The assumption here is that students will not have observees
    // This could be an invalid assumption though.
    let observees = await fetch(url).then(async function(res) {
        let obs = await res.text().then(unpackAPIResponse);
        return obs;
    });

    if (observees.length > 0)
    {
        for (let i = 0; i < observees.length; i++)
        {
            addStudentAssignments(observees[i].id, `${observees[i].name}'s`, sidebar);
        }
    }
    else
    {
        // We're a student
        addStudentAssignments("self", "My", sidebar);
    }
    
}

// Script entry point
// Wait for the side bar to load so we can inject into it.
//
waitForLoad();
