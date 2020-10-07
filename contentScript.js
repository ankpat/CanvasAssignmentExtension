
DEBUG = true;

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
    var links = linkHeader.split(",");
    
    var pages = {};
    for (var i = 0; i < links.length; i++) {
        let m = links[i].match(/<(https:.*)>.*rel="(.*)"/);
        let rel = m[2];
        let page = m[1];
        pages[rel] = page;
    }

    return pages
}

/* Generate a list item containing an assignment and
 * append it to an unordered list element
 */
function updateAssignments(assignment, userId, updateList, container, submissions) {

    // Check for various assignment flags
    // fetch submissions
    //
    //if (DEBUG) {
    //    console.log("SUBMISISONSS");
    //    console.log(submissions);
    //}
    var submission_xhr = new XMLHttpRequest();
    let url = `https://hcpss.instructure.com/api/v1/courses/${assignment["course_id"]}/assignments/${assignment["id"]}/submissions/${userId}`;
    submission_xhr.open("GET", url, true);
    submission_xhr.onreadystatechange = function() {
      if (submission_xhr.readyState == 4) {
        var item = document.createElement("li");
        var assignmentLink = document.createElement("a");
        var text = submission_xhr.responseText;
        var jsonObject = unpackAPIResponse(text);
          if (jsonObject['workflow_state'] == "unsubmitted") {
              console.log(jsonObject);
            assignmentLink.setAttribute("href", `${assignment["html_url"]}`);
            
            assignmentLink.innerHTML = assignment.name;
            
            item.appendChild(assignmentLink);
            
            updateList.append(item);
              container.style = "";
          }
      }
    }
    submission_xhr.send();
             

    //if (DEBUG) console.log(assignment);
}

/* Fetch all assignments from the current page in URL and all subsequent
 * pages.
 * Add each assignment as a list item in the unordered updateList.
 * Hide the enclosing container if there are no assignments.
 */
function fetchAssignmentsAndUpdate(url, userId, container, updateList) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var pages = parseLinkHeader(xhr.getResponseHeader("link"));

        let text = xhr.responseText;
        let jsonObject = unpackAPIResponse(text);
        assignmentsLeft = jsonObject.filter(assignment => //!assignment.has_submitted_submissions && 
            (Date.now() > new Date(assignment["unlock_at"]))
        );

        if (pages["current"] != pages["last"]) {
            fetchAssignmentsAndUpdate(pages["next"], userId, updateList);
        }
        for(var i = 0; i < assignmentsLeft.length; i++) {
            // Generate requests here and use this function as the completion
            updateAssignments(assignmentsLeft[i], userId, updateList, container, jsonObject);
        }
      }
    }
    xhr.send();
}

/* Retrieve all assignments for a given course and update the list of
 * unsubmitted assignments
 */
function fetchAssignmentsForCourse(course, userId, updateList) {
    var container = document.createElement("div");
    var headerLink = document.createElement("a");
    headerLink.setAttribute("href", `/courses/${course["id"]}`);

    var header = document.createElement("h2");
    header.innerHTML = course["name"];
    headerLink.appendChild(header);

    container.appendChild(headerLink);
    var list = document.createElement("ul");
    container.appendChild(list);
    updateList.appendChild(container);

    // Hide the container until we have an assignment
    container.style = "display:none";
    
    fetchAssignmentsAndUpdate(`https://hcpss.instructure.com/api/v1/courses/${course['id']}/assignments?page=1&per_page=10`, userId, container, list);
}

/* Fetch all assignments from all courses
 */
function fetchAllAssignmentsFromCourses(url, userId, updateList) {
    // Fetch all courses and for each course, fetch all assignments
    // Do the request
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var pages = parseLinkHeader(xhr.getResponseHeader("link"));
        
        var text = xhr.responseText;
        var jsonObject = unpackAPIResponse(text);

        validCourses = jsonObject.filter(course => !('access_restricted_by_date' in course));
          
        if (pages["current"] != pages["last"]) {
            fetchAllAssignmentsFromCourses(pages["next"], userId, updateList);
        }
        for(var i = 0; i < validCourses.length; i++) {
            fetchAssignmentsForCourse(validCourses[i], userId, updateList);
        }
      }
    }
    xhr.send();
}


function fetchAllAssignments(userId, updateList) {
    // Fetch assignments from courses
    // fetchAllAssignmentsFromCourses(updateList);
    fetchAllAssignmentsFromCourses(`https://hcpss.instructure.com/api/v1/users/${userId}/courses?page=1&per_page=10`, userId, updateList);
}

/* Wait for the side-bar to load before attempting to modify it. */
function waitForLoad () {
  const el = document.getElementsByClassName("events_list");

  if (el.length) {
    populateSidebar();
  } else {
    setTimeout(waitForLoad, 300); // try again in 300 milliseconds
  }
}

waitForLoad();

function populateSidebar() {
    var sidebar = document.getElementById("right-side");

    var container = document.createElement("div");

    var header = document.createElement("h3");
    header.innerHTML = "Unsubmitted Assignments";

    console.log(window);
    // Check if we're a student or an observer

    // Fetch all observees
    var xhr = new XMLHttpRequest();

    let url = `https://hcpss.instructure.com/api/v1/users/self/observees`;
    
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        var pages = parseLinkHeader(xhr.getResponseHeader("link"));
        
        var text = xhr.responseText;
        var observees = unpackAPIResponse(text);

        if (observees.length > 0)
        {
            for (let i = 0; i < observees.length; i++)
            {
                fetchAllAssignments(observees[i].id, container);
            }
        }
        else
        {
            fetchAllAssignments("self", container);
        }
        // for all observees or self
      }
    }
    xhr.send();
    
    
    container.appendChild(header);
    sidebar.appendChild(container);

}

